import type { BackupDestinationStatus } from "@wherehouse/api-client";

export function remoteBackupPresentation(
  destination: BackupDestinationStatus | null,
) {
  if (!destination) return "Loading…";
  if (destination.state === "not_configured") return "Not connected";
  if (destination.needs_attention) return "Needs attention";
  return "Connected";
}
