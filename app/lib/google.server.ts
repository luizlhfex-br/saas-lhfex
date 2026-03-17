import crypto from "crypto";
import { readFile } from "fs/promises";
import { createCookie } from "react-router";
import { and, eq, isNull } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "./db.server";
import { googleTokens } from "../../drizzle/schema";

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
];

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const GOOGLE_OAUTH_STATE_COOKIE_NAME = IS_PRODUCTION
  ? "__Host-google-oauth-state"
  : "lhfex-google-oauth-state";

const googleOAuthStateCookie = createCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax",
  path: "/",
  maxAge: 10 * 60,
});

type GoogleOAuthClientPayload = {
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
    javascript_origins?: string[];
    project_id?: string;
  };
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
    javascript_origins?: string[];
    project_id?: string;
  };
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configuredRedirectUris: string[];
  projectId?: string;
  source: "env" | "json";
};

type GoogleTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
};

function buildGoogleCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/google/callback`;
}

function getAppOrigin(): string | null {
  const appUrl = process.env.APP_URL?.trim();
  return appUrl ? appUrl.replace(/\/$/, "") : null;
}

async function loadGoogleOAuthClientPayload(): Promise<GoogleOAuthClientPayload | null> {
  const jsonPath = process.env.GOOGLE_OAUTH_CLIENT_JSON_PATH?.trim();
  if (!jsonPath) return null;

  try {
    const raw = await readFile(jsonPath, "utf8");
    return JSON.parse(raw) as GoogleOAuthClientPayload;
  } catch (error) {
    console.error("[google] nao foi possivel ler GOOGLE_OAUTH_CLIENT_JSON_PATH", error);
    return null;
  }
}

function pickClientSource(payload: GoogleOAuthClientPayload | null) {
  return payload?.web ?? payload?.installed ?? null;
}

function resolveRedirectUri(request?: Request, configuredRedirectUris: string[] = []): string | null {
  const envRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (envRedirect) {
    return envRedirect;
  }

  const configuredRedirect = configuredRedirectUris.find((value) => value.trim().length > 0);
  if (configuredRedirect) {
    return configuredRedirect;
  }

  if (request) {
    return buildGoogleCallbackUrl(new URL(request.url).origin);
  }

  const appOrigin = getAppOrigin();
  return appOrigin ? buildGoogleCallbackUrl(appOrigin) : null;
}

async function getGoogleOAuthConfig(request?: Request): Promise<GoogleOAuthConfig> {
  const payload = await loadGoogleOAuthClientPayload();
  const clientSource = pickClientSource(payload);

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || clientSource?.client_id?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || clientSource?.client_secret?.trim();
  const configuredRedirectUris = (clientSource?.redirect_uris ?? [])
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0);
  const redirectUri = resolveRedirectUri(request, configuredRedirectUris);

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn("[google] credenciais OAuth incompletas");
    throw new Error("Google OAuth nao configurado completamente");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    configuredRedirectUris,
    projectId: clientSource?.project_id?.trim(),
    source: clientSource ? "json" : "env",
  };
}

async function createGoogleOAuthClient(request?: Request) {
  const config = await getGoogleOAuthConfig(request);
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );

  if (
    config.source === "json" &&
    config.configuredRedirectUris.length > 0 &&
    !config.configuredRedirectUris.includes(config.redirectUri)
  ) {
    console.warn(
      `[google] redirect URI ${config.redirectUri} nao esta listada no client OAuth salvo em JSON`,
    );
  }

  return { oauth2Client, config };
}

function generateGoogleOAuthState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function startGoogleOAuth(request: Request) {
  const { oauth2Client, config } = await createGoogleOAuthClient(request);
  const state = generateGoogleOAuthState();

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
  });

  return {
    authorizationUrl,
    redirectUri: config.redirectUri,
    stateCookieHeader: await googleOAuthStateCookie.serialize(state),
  };
}

export async function clearGoogleOAuthStateCookie(): Promise<string> {
  return googleOAuthStateCookie.serialize("", { maxAge: 0 });
}

export async function validateGoogleOAuthState(request: Request, returnedState: string | null) {
  const cookieHeader = request.headers.get("cookie");
  const expectedState = await googleOAuthStateCookie.parse(cookieHeader);

  if (!returnedState || typeof expectedState !== "string" || expectedState.length === 0) {
    throw new Error("Google OAuth state ausente");
  }

  if (returnedState.length !== expectedState.length) {
    throw new Error("Google OAuth state invalido");
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(returnedState, "utf8"),
      Buffer.from(expectedState, "utf8"),
    )
  ) {
    throw new Error("Google OAuth state invalido");
  }
}

export async function exchangeCodeForTokens(
  code: string,
  request: Request,
): Promise<GoogleTokenExchangeResult> {
  try {
    const { oauth2Client } = await createGoogleOAuthClient(request);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.expiry_date) {
      throw new Error("Google nao retornou access_token ou expiry_date");
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(tokens.expiry_date),
      scope: tokens.scope ?? undefined,
    };
  } catch (error) {
    console.error("[google] erro ao trocar codigo por tokens", error);
    throw new Error("Falha ao autenticar com Google");
  }
}

export async function saveGoogleToken(
  userId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date,
  scope: string | undefined,
) {
  await db.delete(googleTokens).where(eq(googleTokens.userId, userId));

  return db.insert(googleTokens).values({
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    scope,
  });
}

export async function getValidGoogleToken(userId: string) {
  const token = await db.query.googleTokens.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.userId, userId), isNull(t.disconnectedAt)),
  });

  if (!token) return null;

  if (token.expiresAt < new Date()) {
    if (!token.refreshToken) {
      await disconnectGoogle(userId);
      return null;
    }

    try {
      const { oauth2Client } = await createGoogleOAuthClient();
      oauth2Client.setCredentials({
        refresh_token: token.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials.access_token || !credentials.expiry_date) {
        throw new Error("Refresh do Google retornou credenciais incompletas");
      }

      const newAccessToken = credentials.access_token;
      const newExpiresAt = new Date(credentials.expiry_date);

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
      console.error("[google] erro ao renovar token", error);
      await disconnectGoogle(userId);
      return null;
    }
  }

  return token;
}

export async function disconnectGoogle(userId: string) {
  return db
    .update(googleTokens)
    .set({ disconnectedAt: new Date() })
    .where(and(eq(googleTokens.userId, userId), isNull(googleTokens.disconnectedAt)));
}

async function buildAuthorizedGoogleClient(userId: string) {
  const token = await getValidGoogleToken(userId);
  if (!token) return null;

  const { oauth2Client } = await createGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken ?? undefined,
  });

  return oauth2Client;
}

export async function getAuthenticatedSheetsClient(userId: string) {
  const auth = await buildAuthorizedGoogleClient(userId);
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
}

export async function getAuthenticatedDriveClient(userId: string) {
  const auth = await buildAuthorizedGoogleClient(userId);
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

export async function getAuthenticatedCalendarClient(userId: string) {
  const auth = await buildAuthorizedGoogleClient(userId);
  if (!auth) return null;
  return google.calendar({ version: "v3", auth });
}

type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  remindersMinutes?: number[];
};

export async function createGoogleCalendarEvent(userId: string, input: CalendarEventInput) {
  const calendarClient = await getAuthenticatedCalendarClient(userId);
  if (!calendarClient) return null;

  try {
    const reminders = (input.remindersMinutes ?? [])
      .filter((minutes) => Number.isFinite(minutes) && minutes >= 0)
      .map((minutes) => ({ method: "popup" as const, minutes }));

    const event = await calendarClient.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: {
          dateTime: input.startDateTime,
          timeZone: input.timeZone || "America/Sao_Paulo",
        },
        end: {
          dateTime: input.endDateTime,
          timeZone: input.timeZone || "America/Sao_Paulo",
        },
        reminders: reminders.length > 0
          ? { useDefault: false, overrides: reminders }
          : { useDefault: true },
      },
    });

    return {
      id: event.data.id,
      htmlLink: event.data.htmlLink,
      status: event.data.status,
    };
  } catch (error) {
    console.error("[google] erro ao criar evento no Calendar", error);
    return null;
  }
}

export async function createGoogleSheet(
  userId: string,
  title: string,
  folderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID!,
) {
  const sheetsClient = await getAuthenticatedSheetsClient(userId);
  const driveClient = await getAuthenticatedDriveClient(userId);

  if (!sheetsClient || !driveClient || !folderId) return null;

  try {
    const spreadsheet = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error("Google Sheets nao retornou spreadsheetId");
    }

    await driveClient.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: "root",
      fields: "id, parents",
    });

    await driveClient.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      spreadsheetId,
      title,
      shareLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`,
    };
  } catch (error) {
    console.error("[google] erro ao criar Google Sheet", error);
    return null;
  }
}

