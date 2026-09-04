import {
  connectDropbox,
  checkForUpdate,
  createPairingSession,
  disconnectDropbox,
  getBackupStatus,
  getSystemStatus,
  getUpdateStatus,
  installUpdate,
  listDevices,
  revokeDevice,
  runRemoteBackup,
  type BackupStatus,
  type ApplianceUpdateStatus,
  type Device,
  type Workspace,
  type MeResponse,
  type PairingSession,
  type SystemStatus,
} from "@wherehouse/api-client";
import {
  CircleUserRound,
  Cloud,
  Database,
  House,
  Info,
  Laptop,
  Palette,
  Shield,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "../../components/wherehouse/ConfirmDialog";
import { PageHeader } from "../../components/wherehouse/PageHeader";
import { formatDate } from "../../shared/utils/date";
import { message } from "../../shared/utils/errors";
import type { SettingsSection } from "../../shared/utils/navigation";

const sections: { id: SettingsSection; label: string; icon: typeof House }[] = [
  { id: "account", label: "Account", icon: CircleUserRound },
  { id: "workspaces", label: "Households", icon: House },
  { id: "backups", label: "Backup & Restore", icon: Cloud },
  { id: "system", label: "System", icon: RefreshCw },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "privacy", label: "Data & Privacy", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

export function SettingsView({
  workspace,
  workspaces,
  isOwner,
  onCreateWorkspace,
  onNavigate,
  onSelect,
  section,
  token,
  user,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  isOwner: boolean;
  onCreateWorkspace: (name: string) => Promise<void>;
  onNavigate: (section: SettingsSection) => void;
  onSelect: (id: string) => void;
  section: SettingsSection;
  token: string;
  user: MeResponse;
}) {
  return (
    <div className="settings-page">
      <PageHeader eyebrow="WhereHouse" title="Settings" />
      <div className="settings-layout">
        <nav aria-label="Settings sections" className="settings-nav">
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              className={section === id ? "active" : ""}
              href={`/settings/${id}`}
              key={id}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(id);
              }}
            >
              <Icon aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <section className="settings-content">
          {section === "account" ? (
            <Account user={user} />
          ) : section === "workspaces" ? (
            <Workspaces
              workspace={workspace}
              workspaces={workspaces}
              isOwner={isOwner}
              onCreate={onCreateWorkspace}
              onSelect={onSelect}
              token={token}
              user={user}
            />
          ) : section === "backups" ? (
            <Backups isOwner={isOwner} token={token} />
          ) : section === "system" ? (
            <SoftwareUpdate isOwner={isOwner} token={token} />
          ) : section === "preferences" ? (
            <Preferences />
          ) : section === "privacy" ? (
            <Privacy />
          ) : (
            <About />
          )}
        </section>
      </div>
    </div>
  );
}

const activeUpdatePhases = new Set<ApplianceUpdateStatus["phase"]>([
  "checking", "downloading", "verifying", "backing_up", "installing",
  "migrating", "restarting", "health_check", "rollback",
]);

export function SoftwareUpdate({ isOwner, token }: { isOwner: boolean; token: string }) {
  const [status, setStatus] = useState<ApplianceUpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => getUpdateStatus(token).then((value) => {
    setStatus(value); setError(null); return value;
  }).catch((reason) => { setError(message(reason)); return null; });
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [token]);
  async function check() {
    try { setStatus(await checkForUpdate(token)); setError(null); }
    catch (reason) { setError(message(reason)); }
  }
  async function install() {
    try { setStatus(await installUpdate(token)); setError(null); }
    catch (reason) { setError(message(reason)); }
  }
  const busy = status ? activeUpdatePhases.has(status.phase) : false;
  return <>
    <p className="eyebrow">Appliance application</p>
    <h2>Software Update</h2>
    <div className="settings-card software-update-card">
      <div className="backup-destination-header">
        <div><small>Current version</small><strong>{status?.currentVersion ?? "Loading…"}</strong></div>
        {status?.latestVersion ? <div><small>Latest version</small><strong>{status.latestVersion}</strong></div> : null}
      </div>
      {status ? <>
        <p>{status.message}</p>
        {busy ? <progress aria-label="Update progress" max="100" value={status.progress}>{status.progress}%</progress> : null}
        {status.releaseNotes ? <div><strong>Release notes</strong><p className="muted">{status.releaseNotes}</p></div> : null}
        <p className="muted">Channel: {status.channel}{status.runtimeSize ? ` · Download ${formatBytes(status.runtimeSize)}` : ""}<br />
          {status.lastCheckedAt ? `Last checked ${formatDate(status.lastCheckedAt)}` : "Not checked yet"}</p>
        {status.errorMessage ? <div className="alert">{status.errorMessage}{status.rollbackPerformed ? " Previous application images were restored." : ""}</div> : null}
      </> : null}
      <p className="muted">WhereHouse may be unavailable briefly while the update is installed. The update continues if this browser disconnects.</p>
      {isOwner ? <div className="backup-destination-actions">
        <Button disabled={busy} onClick={() => void check()}>Check for Updates</Button>
        <Button className="primary-button" disabled={busy || !status?.updateAvailable} onClick={() => void install()}>Update Now</Button>
      </div> : <p className="muted">Only household owners can install appliance updates.</p>}
    </div>
    {error ? <div className="alert">{error}</div> : null}
  </>;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function Backups({ isOwner, token }: { isOwner: boolean; token: string }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const refresh = () =>
    getBackupStatus(token)
      .then(setStatus)
      .catch((reason) => setError(message(reason)));
  useEffect(() => {
    void refresh();
  }, [token]);
  async function run() {
    setRunning(true);
    setError(null);
    try {
      await runRemoteBackup(token, "dropbox");
      await refresh();
    } catch (reason) {
      setError(message(reason));
      await refresh();
    } finally {
      setRunning(false);
    }
  }
  async function connect() {
    try {
      const result = await connectDropbox(token);
      location.assign(result.authorization_url);
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function disconnect() {
    try {
      await disconnectDropbox(token);
      await refresh();
    } catch (reason) {
      setError(message(reason));
    }
  }
  return (
    <>
      <p className="eyebrow">Instance scoped</p>
      <h2>Backup & Restore</h2>
      <p className="muted backup-settings-intro">
        These destinations protect this entire WhereHouse instance, including
        every household.
      </p>
      {status ? (
        <BackupStatusPanel
          isOwner={isOwner}
          onConnect={() => void connect()}
          onDisconnect={() => void disconnect()}
          onRun={() => void run()}
          running={running}
          status={status}
        />
      ) : (
        <div className="settings-card">Loading backup status…</div>
      )}
      {error ? <div className="alert">{error}</div> : null}
      <div className="settings-card backup-restore-card">
        <h3>Restore</h3>
        <p className="muted">
          Restore remains an administrator operation because it replaces an
          empty server database and media destination. Use the documented CLI
          confirmation workflow.
        </p>
      </div>
    </>
  );
}

export function BackupStatusPanel({
  isOwner,
  onConnect,
  onDisconnect,
  onRun,
  running,
  status,
}: {
  isOwner: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRun: () => void;
  running: boolean;
  status: BackupStatus;
}) {
  const stateLabel = (state: BackupStatus["destinations"][number]["state"]) =>
    state === "not_configured"
      ? "Not connected"
      : state === "needs_attention" || state === "unavailable"
        ? "Needs attention"
        : "Connected";
  const stateClass = (state: BackupStatus["destinations"][number]["state"]) =>
    state === "connected"
      ? "connected"
      : state === "not_configured"
        ? "not-connected"
        : "needs-attention";
  return (
    <div className="backup-destinations">
      {status.destinations.map((destination) => (
        <article
          className="settings-card backup-destination-card"
          key={destination.provider}
        >
          <div className="backup-destination-header">
            <div>
              <strong>{destination.display_name}</strong>
              <small>
                {destination.kind === "remote"
                  ? "Remote backup"
                  : "Server-local backup"}
              </small>
            </div>
            <span
              className={`backup-state ${stateClass(destination.state)}`}
            >
              {stateLabel(destination.state)}
            </span>
          </div>
          <p className="muted backup-destination-management">
            {destination.management === "cli"
              ? "Configured by the server administrator"
              : "Managed from web settings"}
          </p>
          <p>
            {destination.last_successful_backup_at
              ? `Last successful backup: ${formatDate(destination.last_successful_backup_at)}`
              : (destination.message ?? "No successful backup recorded.")}
          </p>
          <div className="backup-destination-actions">
            {destination.kind === "remote" &&
            destination.configured &&
            isOwner ? (
              <>
              <Button
                className="primary-button compact"
                disabled={running}
                onClick={onRun}
              >
                {running ? "Backing up…" : "Back up now"}
              </Button>
              <Button className="compact" onClick={onConnect}>
                {destination.needs_attention ? "Reauthorize" : "Reconnect"}
              </Button>
              <Button className="danger-button compact" onClick={onDisconnect}>
                Disconnect
              </Button>
              </>
            ) : null}
            {destination.kind === "remote" &&
            !destination.configured &&
            isOwner ? (
              <Button className="primary-button compact" onClick={onConnect}>
                Connect Dropbox
              </Button>
            ) : null}
          </div>
          {destination.needs_attention ? (
            <p className="alert">Reconnect or reauthorize Dropbox.</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Account({ user }: { user: MeResponse }) {
  return (
    <>
      <p className="eyebrow">User scoped</p>
      <h2>Account</h2>
      <div className="settings-card">
        <label>
          Display name
          <input disabled value={user.user.display_name} />
        </label>
        <label>
          Email address
          <input disabled value={user.user.email} />
        </label>
        <p className="muted">
          Profile and password changes are not yet supported by the account API.
        </p>
      </div>
    </>
  );
}

function Workspaces({
  workspace,
  workspaces,
  isOwner,
  onCreate,
  onSelect,
  token,
  user,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  isOwner: boolean;
  onCreate: (name: string) => Promise<void>;
  onSelect: (id: string) => void;
  token: string;
  user: MeResponse;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [pairingDeviceBaseline, setPairingDeviceBaseline] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);
  const [revoking, setRevoking] = useState(false);
  useEffect(() => {
    setPairing(null);
    setQrCode("");
    if (isOwner)
      void listDevices(token, workspace.id)
        .then(setDevices)
        .catch((reason) => setError(message(reason)));
    else setDevices([]);
  }, [workspace.id, isOwner, token]);
  useEffect(() => {
    if (pairing)
      void QRCode.toDataURL(pairing.pairing_uri, {
        margin: 1,
        width: 260,
      }).then(setQrCode);
  }, [pairing]);
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    async function refreshDevices() {
      const next = await listDevices(token, workspace.id);
      if (cancelled) return;
      setDevices(next);
      if (
        pairing &&
        next.filter((device) => device.is_active).length > pairingDeviceBaseline
      ) {
        setPairing(null);
        setQrCode("");
      }
    }
    const interval = window.setInterval(
      () =>
        void refreshDevices().catch(
          (reason) => !cancelled && setError(message(reason)),
        ),
      2_000,
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [workspace.id, isOwner, pairing?.id, pairingDeviceBaseline, token]);
  async function pair() {
    try {
      const current = await listDevices(token, workspace.id);
      setDevices(current);
      setPairingDeviceBaseline(
        current.filter((device) => device.is_active).length,
      );
      setPairing(
        await createPairingSession(token, workspace.id, {
          instance_name: `${workspace.name} WhereHouse`,
          instance_type: location.hostname === "localhost" ? "local" : "cloud",
        }),
      );
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function revoke() {
    if (!deviceToRevoke) return;
    setRevoking(true);
    try {
      await revokeDevice(token, deviceToRevoke.id);
      setDevices(await listDevices(token, workspace.id));
      setDeviceToRevoke(null);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setRevoking(false);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(newWorkspaceName.trim());
      setNewWorkspaceName("");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setCreating(false);
    }
  }
  const role = user.workspaces.find(
    (entry) => entry.workspace_id === workspace.id,
  )?.role;
  return (
    <>
      <p className="eyebrow">Household scoped</p>
      <h2>Households</h2>
      <form
        className="settings-card add-workspace-form"
        onSubmit={(event) => void create(event)}
      >
        <h3>Add Household</h3>
        <p className="muted">
          Create another independent inventory context. You will become its
          owner.
        </p>
        <label>
          Household name
          <input
            disabled={creating}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder="Workshop, cabin, storage unit…"
            required
            value={newWorkspaceName}
          />
        </label>
        <Button
          className="primary-button compact"
          disabled={creating || !newWorkspaceName.trim()}
          type="submit"
        >
          {creating ? "Creating…" : "Add household"}
        </Button>
      </form>
      <div className="workspace-list">
        {workspaces.map((entry) => (
          <Button
            className={entry.id === workspace.id ? "active" : ""}
            key={entry.id}
            onClick={() => onSelect(entry.id)}
          >
            <House aria-hidden="true" />
            <span>
              <strong>{entry.name}</strong>
              <small>
                {user.workspaces.find(
                  (access) => access.workspace_id === entry.id,
                )?.role ?? "member"}
                {entry.id === workspace.id ? " · Active" : ""}
              </small>
            </span>
          </Button>
        ))}
      </div>
      <div className="settings-card" id="connected-devices">
        <h3>{workspace.name}</h3>
        <p className="muted">Your relationship: {role}</p>
        <h3>Connected Devices</h3>
        {isOwner ? (
          <>
            <Button
              className="primary-button compact"
              onClick={() => void pair()}
            >
              Pair a device
            </Button>
            {pairing && qrCode ? (
              <div className="settings-pairing">
                <img alt="One-time device pairing QR code" src={qrCode} />
                <span>Expires {formatDate(pairing.expires_at)}</span>
              </div>
            ) : null}
            <div className="device-list">
              {devices.map((device) => (
                <article key={device.id}>
                  <div className="device-icon">
                    {device.device_type === "phone" ? (
                      <Smartphone />
                    ) : (
                      <Laptop />
                    )}
                  </div>
                  <div>
                    <strong>{device.name}</strong>
                    <span>
                      {device.device_type} ·{" "}
                      {device.is_active
                        ? `Active · Last seen ${formatDate(device.last_seen_at)}`
                        : `Revoked ${formatDate(device.revoked_at)}`}
                    </span>
                  </div>
                  {device.is_active ? (
                    <Button
                      className="danger-button"
                      onClick={() => setDeviceToRevoke(device)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
            {devices.length ? null : (
              <p className="muted">
                No paired devices yet. Pair a phone to use the mobile companion.
              </p>
            )}
          </>
        ) : (
          <p className="notice">
            Only household owners can manage connected devices and members.
          </p>
        )}
        {error ? <div className="alert">{error}</div> : null}
      </div>
      <ConfirmDialog
        busy={revoking}
        confirmLabel="Revoke device"
        description={`${deviceToRevoke?.name ?? "This device"} will disconnect immediately and must be paired again before it can sync.`}
        destructive
        onCancel={() => setDeviceToRevoke(null)}
        onConfirm={revoke}
        open={Boolean(deviceToRevoke)}
        title="Revoke device?"
      />
    </>
  );
}

function Preferences() {
  return (
    <>
      <p className="eyebrow">Local preference</p>
      <h2>Preferences</h2>
      <div className="settings-card">
        <h3>Appearance</h3>
        <p className="muted">
          WhereHouse follows your system appearance. Explicit theme selection
          will be added when theming is supported end to end.
        </p>
      </div>
    </>
  );
}
function Privacy() {
  return (
    <>
      <p className="eyebrow">Device and household data</p>
      <h2>Data & Privacy</h2>
      <div className="settings-card">
        <Database aria-hidden="true" />
        <h3>Local-first inventory</h3>
        <p className="muted">
          Household inventory remains authoritative on your WhereHouse instance.
          This browser stores only session and active-household preferences.
        </p>
      </div>
    </>
  );
}
function About() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  useEffect(() => { void getSystemStatus().then(setSystem).catch(() => undefined); }, []);
  return (
    <>
      <p className="eyebrow">Application</p>
      <h2>About</h2>
      <div className="settings-card about-card">
        <img alt="WhereHouse" src="/logo.png" />
        <h3>WhereHouse</h3>
        <p className="muted">
          Local-first household inventory and spatial organization.
        </p>
        <small>Web version {__APP_VERSION__}</small>
        {system ? (
          <p className="muted">
            Server {system.application_version} · schema {system.schema_version ?? "unknown"}<br />
            Image {system.image_version ?? "not packaged"} · {system.hostname}<br />
            {system.device_model ?? system.os_version}<br />
            Storage: {system.storage.message}
          </p>
        ) : null}
      </div>
    </>
  );
}
