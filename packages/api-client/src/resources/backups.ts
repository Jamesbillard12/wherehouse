import { apiRequest } from "../client";
import type { BackupStatus } from "../types";

export function getBackupStatus(token: string, baseUrl?: string) {
  return apiRequest<BackupStatus>("/backups/status", { baseUrl, token });
}

export function runRemoteBackup(
  token: string,
  provider: string,
  baseUrl?: string,
) {
  return apiRequest<{ key: string; size: number }>(
    `/backups/providers/${encodeURIComponent(provider)}/run`,
    {
      baseUrl,
      method: "POST",
      token,
    },
  );
}

export function connectDropbox(token: string, baseUrl?: string) {
  return apiRequest<{ authorization_url: string }>(
    "/backups/providers/dropbox/connect",
    {
      baseUrl,
      method: "POST",
      token,
    },
  );
}

export function disconnectDropbox(token: string, baseUrl?: string) {
  return apiRequest<void>("/backups/providers/dropbox", {
    baseUrl,
    method: "DELETE",
    token,
  });
}
