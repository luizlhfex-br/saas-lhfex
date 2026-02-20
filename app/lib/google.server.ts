import { google } from "googleapis";
import { db } from "./db.server";
import { googleTokens } from "../../drizzle/schema";
import { eq, isNull } from "drizzle-orm";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.warn("⚠️  Google OAuth credentials not fully configured");
}

export const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

/**
 * Gera URL de autorização do Google
 */
export function getAuthorizationUrl(): string {
  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // força reconsentimento pra garantir refresh token
  });
}

/**
 * Troca código de autorização por tokens
 */
export async function exchangeCodeForTokens(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope,
    };
  } catch (error) {
    console.error("❌ Error exchanging Google auth code:", error);
    throw new Error("Failed to authenticate with Google");
  }
}

/**
 * Salva token no banco pra usuário
 */
export async function saveGoogleToken(
  userId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date,
  scope: string | undefined,
) {
  // Delete old token if exists
  await db
    .delete(googleTokens)
    .where(eq(googleTokens.userId, userId));

  // Insert new token
  return await db.insert(googleTokens).values({
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    scope,
  });
}

/**
 * Busca token válido do usuário
 */
export async function getValidGoogleToken(userId: string) {
  const token = await db.query.googleTokens.findFirst({
    where: (t) => (eq(t.userId, userId), isNull(t.disconnectedAt)),
  });

  if (!token) return null;

  // Se expirou, tenta refresh
  if (token.expiresAt < new Date()) {
    if (!token.refreshToken) {
      // Token expirou e não tem refresh → desconecta
      await disconnectGoogle(userId);
      return null;
    }

    try {
      oauth2Client.setCredentials({
        refresh_token: token.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token!;
      const newExpiresAt = new Date(credentials.expiry_date!);

      // Atualiza no banco
      await db
        .update(googleTokens)
        .set({
          accessToken: newAccessToken,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(googleTokens.userId, userId));

      return { ...token, accessToken: newAccessToken, expiresAt: newExpiresAt };
    } catch (error) {
      console.error("❌ Error refreshing Google token:", error);
      await disconnectGoogle(userId);
      return null;
    }
  }

  return token;
}

/**
 * Desconecta Google (soft delete)
 */
export async function disconnectGoogle(userId: string) {
  return await db
    .update(googleTokens)
    .set({ disconnectedAt: new Date() })
    .where(eq(googleTokens.userId, userId));
}

/**
 * Cria Google Sheets API client autenticado
 */
export async function getAuthenticatedSheetsClient(userId: string) {
  const token = await getValidGoogleToken(userId);
  if (!token) return null;

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  return google.sheets({ version: "v4", auth: oauth2Client });
}

/**
 * Cria Google Drive API client autenticado
 */
export async function getAuthenticatedDriveClient(userId: string) {
  const token = await getValidGoogleToken(userId);
  if (!token) return null;

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Cria novo Google Sheet na pasta configurada
 */
export async function createGoogleSheet(
  userId: string,
  title: string,
  folderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID!,
) {
  const sheetsClient = await getAuthenticatedSheetsClient(userId);
  const driveClient = await getAuthenticatedDriveClient(userId);

  if (!sheetsClient || !driveClient) return null;

  try {
    // 1. Cria a planilha
    const spreadsheet = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;

    // 2. Move pra pasta configurada
    await driveClient.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: "root",
      fields: "id, parents",
    });

    // 3. Compartilha como viewer (link público)
    await driveClient.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const shareLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

    return {
      spreadsheetId,
      title,
      shareLink,
    };
  } catch (error) {
    console.error("❌ Error creating Google Sheet:", error);
    return null;
  }
}
