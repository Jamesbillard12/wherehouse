import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BackupStatusPanel } from "./SettingsView";

const status = (
  state: "not_configured" | "connected" | "needs_attention",
  last: string | null = null,
) => ({
  scope: "instance" as const,
  overall:
    state === "needs_attention"
      ? ("needs_attention" as const)
      : state === "connected"
        ? ("protected" as const)
        : ("no_backup_configured" as const),
  destinations: [
    {
      kind: "remote" as const,
      provider: "dropbox",
      display_name: "Dropbox",
      state,
      configured: state !== "not_configured",
      needs_attention: state === "needs_attention",
      last_successful_backup_at: last,
      management: "web" as const,
      message: null,
    },
  ],
});

describe("BackupStatusPanel", () => {
  it("renders provider-neutral connected status and last success", () => {
    render(
      <BackupStatusPanel
        isOwner
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRun={vi.fn()}
        running={false}
        status={status("connected", "2026-09-02T21:14:00Z")}
      />,
    );
    expect(screen.getByText("Dropbox")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/Last successful backup:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back up now" }),
    ).toBeInTheDocument();
  });

  it("renders disconnected and needs-attention states without secrets", () => {
    const { rerender } = render(
      <BackupStatusPanel
        isOwner
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRun={vi.fn()}
        running={false}
        status={status("not_configured")}
      />,
    );
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back up now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect Dropbox" }),
    ).toBeInTheDocument();
    rerender(
      <BackupStatusPanel
        isOwner
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRun={vi.fn()}
        running={false}
        status={status("needs_attention")}
      />,
    );
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText(/Reconnect or reauthorize/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reauthorize" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/token|secret/i);
  });
});
