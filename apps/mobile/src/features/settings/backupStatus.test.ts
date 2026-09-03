import { describe, expect, it } from "vitest";

import { remoteBackupPresentation } from "./backupStatus";

const destination = (
  state: "not_configured" | "connected" | "needs_attention",
) => ({
  kind: "remote" as const,
  provider: "dropbox",
  display_name: "Dropbox",
  state,
  configured: state !== "not_configured",
  needs_attention: state === "needs_attention",
  last_successful_backup_at:
    state === "connected" ? "2026-09-02T21:14:00Z" : null,
  management: "web" as const,
  message: null,
});

describe("mobile remote backup presentation", () => {
  it("renders connected, not-connected, and needs-attention states", () => {
    expect(remoteBackupPresentation(destination("connected"))).toBe(
      "Connected",
    );
    expect(remoteBackupPresentation(destination("not_configured"))).toBe(
      "Not connected",
    );
    expect(remoteBackupPresentation(destination("needs_attention"))).toBe(
      "Needs attention",
    );
  });

  it("contains no provider credential fields", () => {
    expect(Object.keys(destination("connected"))).not.toContain("access_token");
    expect(Object.keys(destination("connected"))).not.toContain(
      "refresh_token",
    );
  });
});
