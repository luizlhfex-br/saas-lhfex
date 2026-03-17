import { existsSync } from "node:fs";

export type VertexAuthMode =
  | "application-default-credentials"
  | "application-default-credentials-missing"
  | "service-account-file"
  | "service-account-file-missing"
  | "unconfigured";

export interface VertexAuthState {
  projectId: string | null;
  credentialsPath: string | null;
  credentialsFileExists: boolean;
  defaultCredentialsPath: string | null;
  defaultCredentialsFileExists: boolean;
  authMode: VertexAuthMode;
}

function getApplicationDefaultCredentialsPath(): string | null {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    return appData ? `${appData}\\gcloud\\application_default_credentials.json` : null;
  }

  const home = process.env.HOME?.trim();
  return home ? `${home}/.config/gcloud/application_default_credentials.json` : null;
}

export function getVertexProjectId(): string | null {
  return (
    process.env.GOOGLE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    null
  );
}

export function getVertexAuthState(): VertexAuthState {
  const projectId = getVertexProjectId();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || null;
  const credentialsFileExists = credentialsPath ? existsSync(credentialsPath) : false;
  const defaultCredentialsPath = getApplicationDefaultCredentialsPath();
  const defaultCredentialsFileExists = defaultCredentialsPath ? existsSync(defaultCredentialsPath) : false;

  let authMode: VertexAuthMode = "unconfigured";
  if (projectId) {
    authMode = credentialsPath
      ? credentialsFileExists
        ? "service-account-file"
        : "service-account-file-missing"
      : defaultCredentialsFileExists
        ? "application-default-credentials"
        : "application-default-credentials-missing";
  }

  return {
    projectId,
    credentialsPath,
    credentialsFileExists,
    defaultCredentialsPath,
    defaultCredentialsFileExists,
    authMode,
  };
}

export function isVertexConfigured(): boolean {
  const state = getVertexAuthState();
  return Boolean(state.projectId) && (
    state.authMode === "service-account-file" ||
    state.authMode === "application-default-credentials"
  );
}
