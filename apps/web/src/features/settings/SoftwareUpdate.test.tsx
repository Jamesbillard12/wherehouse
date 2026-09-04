import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUpdateStatus, checkForUpdate, installUpdate } = vi.hoisted(() => ({
  getUpdateStatus: vi.fn(), checkForUpdate: vi.fn(), installUpdate: vi.fn(),
}));

vi.mock("@wherehouse/api-client", async (original) => ({
  ...(await original<typeof import("@wherehouse/api-client")>()),
  getUpdateStatus,
  checkForUpdate,
  installUpdate,
}));

import { SoftwareUpdate } from "./SettingsView";

const available = {
  currentVersion: "0.1.9", latestVersion: "0.1.10", targetVersion: "0.1.10",
  updateAvailable: true, channel: "stable" as const, phase: "available" as const,
  progress: 0, message: "Update available", releaseNotes: "Safer updates",
  runtimeSize: 1024, publishedAt: "2026-09-03T00:00:00Z",
  lastCheckedAt: "2026-09-03T00:00:00Z", errorCode: null, errorMessage: null,
  rollbackPerformed: false,
};

describe("SoftwareUpdate", () => {
  beforeEach(() => {
    getUpdateStatus.mockReset().mockResolvedValue(available);
    checkForUpdate.mockReset().mockResolvedValue(available);
    installUpdate.mockReset().mockResolvedValue({ ...available, phase: "checking" });
  });

  it("shows versions and lets an owner start the durable update", async () => {
    render(<SoftwareUpdate isOwner token="token" />);
    expect(await screen.findByText("0.1.10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update Now" }));
    await waitFor(() => expect(installUpdate).toHaveBeenCalledWith("token"));
    expect(screen.getByText(/continues if this browser disconnects/i)).toBeInTheDocument();
  });

  it("does not offer update controls to non-owners", async () => {
    render(<SoftwareUpdate isOwner={false} token="token" />);
    expect(await screen.findByText(/only household owners/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Now" })).not.toBeInTheDocument();
  });
});
