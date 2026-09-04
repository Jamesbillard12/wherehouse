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
  serviceAvailable: true,
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
    const checkButton = screen.getByRole("button", { name: "Check for Updates" });
    const updateButton = screen.getByRole("button", { name: "Update Now" });
    expect(checkButton).toHaveAttribute("data-slot", "button");
    expect(updateButton).toHaveAttribute("data-slot", "button");
    expect(updateButton).not.toHaveClass("primary-button");
    fireEvent.click(checkButton);
    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledWith("token"));
    fireEvent.click(updateButton);
    await waitFor(() => expect(installUpdate).toHaveBeenCalledWith("token"));
    expect(screen.getByText(/continues if this browser disconnects/i)).toBeInTheDocument();
  });

  it("does not offer update controls to non-owners", async () => {
    render(<SoftwareUpdate isOwner={false} token="token" />);
    expect(await screen.findByText(/only household owners/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Now" })).not.toBeInTheDocument();
  });

  it("shows the installed version and disables actions when the updater is unavailable", async () => {
    getUpdateStatus.mockResolvedValue({ ...available, currentVersion: "0.1.1",
      latestVersion: null, updateAvailable: false, phase: "failed",
      serviceAvailable: false, errorCode: "updater_unavailable",
      errorMessage: "Appliance update service is unavailable" });
    render(<SoftwareUpdate isOwner token="token" />);
    expect(await screen.findByText("0.1.1")).toBeInTheDocument();
    expect(screen.getByText(/update service is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for Updates" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Now" })).toBeDisabled();
  });
});
