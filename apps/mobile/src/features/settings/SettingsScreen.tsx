import {
  createWorkspace,
  createPairingSession,
  getBackupStatus,
  getMe,
  listDevices,
  listWorkspaces,
  revokeDevice,
  type BackupDestinationStatus,
  type BackupStatus,
  type Device,
  type Workspace,
  type MeResponse,
  type PairingSession,
} from "@wherehouse/api-client";
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Database,
  House,
  Info,
  Laptop,
  Palette,
  Plus,
  Shield,
  Smartphone,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { ConfirmModal } from "../../components/ConfirmModal";
import type { PairedServer } from "../../services/pairing";
import { styles } from "../../theme/styles";
import { remoteBackupPresentation } from "./backupStatus";

type Section =
  | "more"
  | "account"
  | "workspaces"
  | "workspace"
  | "preferences"
  | "privacy"
  | "about";

const entries = [
  { id: "account" as const, label: "Account", icon: CircleUserRound },
  { id: "workspaces" as const, label: "Households", icon: House },
  { id: "preferences" as const, label: "Preferences", icon: Palette },
  { id: "privacy" as const, label: "Data & Privacy", icon: Shield },
  { id: "about" as const, label: "About", icon: Info },
];

export function SettingsScreen({
  server,
  onForget,
  onSwitch,
}: {
  server: PairedServer;
  onForget: () => void;
  onSwitch: (workspace: Workspace) => Promise<void>;
}) {
  const [section, setSection] = useState<Section>("more");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  async function refresh() {
    const [account, workspaceList, backups] = await Promise.all([
      getMe(server.accessToken, server.baseUrl),
      listWorkspaces(server.accessToken, server.baseUrl),
      getBackupStatus(server.accessToken, server.baseUrl),
    ]);
    setMe(account);
    setWorkspaces(workspaceList);
    setBackupStatus(backups);
  }
  useEffect(() => {
    void refresh().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Could not load settings.",
      ),
    );
  }, [server.accessToken, server.baseUrl]);
  useEffect(() => {
    if (
      section !== "workspace" ||
      !selected ||
      me?.workspaces.find((entry) => entry.workspace_id === selected.id)
        ?.role !== "owner"
    )
      return;
    let cancelled = false;
    let loading = false;
    async function refreshDevices() {
      if (loading || !selected) return;
      loading = true;
      try {
        const next = await listDevices(
          server.accessToken,
          selected.id,
          server.baseUrl,
        );
        if (!cancelled) {
          setDevices(next);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not refresh connected devices.",
          );
      } finally {
        loading = false;
      }
    }
    const interval = setInterval(() => void refreshDevices(), 2_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [me, section, selected, server.accessToken, server.baseUrl]);
  async function chooseWorkspace(workspace: Workspace) {
    if (workspace.id !== server.workspaceId) {
      await onSwitch(workspace);
      return;
    }
    setSelected(workspace);
    setPairing(null);
    setSection("workspace");
    const owner =
      me?.workspaces.find((entry) => entry.workspace_id === workspace.id)
        ?.role === "owner";
    setDevices(
      owner
        ? await listDevices(server.accessToken, workspace.id, server.baseUrl)
        : [],
    );
  }
  async function pairDevice(workspace: Workspace) {
    try {
      setPairing(
        await createPairingSession(
          server.accessToken,
          workspace.id,
          {
            instance_name: `${workspace.name} WhereHouse`,
            instance_type: server.baseUrl.includes("localhost")
              ? "local"
              : "cloud",
          },
          server.baseUrl,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create a pairing link.",
      );
    }
  }
  async function revoke() {
    if (!deviceToRevoke) return;
    try {
      await revokeDevice(server.accessToken, deviceToRevoke.id, server.baseUrl);
      if (selected)
        setDevices(
          await listDevices(server.accessToken, selected.id, server.baseUrl),
        );
      setDeviceToRevoke(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not revoke this device.",
      );
    }
  }
  async function addWorkspace() {
    if (!name.trim()) return;
    const workspace = await createWorkspace(
      server.accessToken,
      name.trim(),
      server.baseUrl,
    );
    setName("");
    await refresh();
    await onSwitch(workspace);
    setSelected(workspace);
    setSection("workspace");
  }
  const title =
    section === "more"
      ? "More"
      : section === "privacy"
        ? "Data & Privacy"
        : section === "workspace"
          ? (selected?.name ?? "Workspace")
          : section[0].toUpperCase() + section.slice(1);
  return (
    <View style={styles.settingsRoot}>
      {section !== "more" ? (
        <Pressable
          accessibilityLabel="Back"
          onPress={() =>
            setSection(section === "workspace" ? "workspaces" : "more")
          }
          style={styles.settingsBack}
        >
          <ChevronLeft color="#4f46e5" size={20} />
          <Text style={styles.settingsBackText}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.settingsTitle}>{title}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {section === "more" ? (
        <>
          <RemoteBackupCard
            destination={
              backupStatus?.destinations.find(
                (item) => item.kind === "remote",
              ) ?? null
            }
          />
          <View style={styles.settingsList}>
            {entries.map(({ id, label, icon: Icon }) => (
              <Pressable
                key={id}
                onPress={() => setSection(id)}
                style={styles.settingsRow}
              >
                <Icon color="#4f46e5" size={20} />
                <Text style={styles.settingsRowText}>{label}</Text>
                <ChevronRight color="#98a2b3" size={18} />
              </Pressable>
            ))}
          </View>
        </>
      ) : section === "account" ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>Display name</Text>
          <Text style={styles.settingsValue}>
            {me?.user.display_name ?? "Loading…"}
          </Text>
          <Text style={styles.settingsLabel}>Email</Text>
          <Text style={styles.settingsValue}>
            {me?.user.email ?? "Loading…"}
          </Text>
          <Pressable
            onPress={() => setConfirmForget(true)}
            style={styles.settingsDanger}
          >
            <Text style={styles.settingsDangerText}>
              Forget this device connection
            </Text>
          </Pressable>
        </View>
      ) : section === "workspaces" ? (
        <>
          <View style={styles.settingsList}>
            {workspaces.map((workspace) => {
              const active = workspace.id === server.workspaceId;
              const role = me?.workspaces.find(
                (entry) => entry.workspace_id === workspace.id,
              )?.role;
              return (
                <Pressable
                  accessibilityHint={
                    active
                      ? "Opens household settings"
                      : "Switches to this household"
                  }
                  accessibilityLabel={`${workspace.name}${active ? ", active" : ""}`}
                  key={workspace.id}
                  onPress={() => void chooseWorkspace(workspace)}
                  style={styles.settingsRow}
                >
                  <House color="#4f46e5" size={20} />
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowText}>{workspace.name}</Text>
                    <Text style={styles.settingsMeta}>
                      {role}
                      {active ? " · Active" : " · Tap to switch"}
                    </Text>
                  </View>
                  <ChevronRight color="#98a2b3" size={18} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsLabel}>Add Household</Text>
            <TextInput
              onChangeText={setName}
              placeholder="Household name"
              style={styles.settingsInput}
              value={name}
            />
            <Pressable
              onPress={() => void addWorkspace()}
              style={styles.settingsPrimary}
            >
              <Plus color="#fff" size={18} />
              <Text style={styles.settingsPrimaryText}>Add household</Text>
            </Pressable>
          </View>
        </>
      ) : section === "workspace" && selected ? (
        <WorkspaceDetail
          devices={devices}
          workspace={selected}
          isActive={selected.id === server.workspaceId}
          me={me}
          onPair={() => pairDevice(selected)}
          onRevoke={setDeviceToRevoke}
          onSwitch={() => onSwitch(selected)}
          pairing={pairing}
        />
      ) : section === "preferences" ? (
        <InfoCard title="Appearance">
          WhereHouse currently follows your system appearance.
        </InfoCard>
      ) : section === "privacy" ? (
        <InfoCard
          icon={<Database color="#4f46e5" size={22} />}
          title="Local data"
        >
          Inventory cache and pending operations are isolated by household.
          Forgetting the connection removes its credential but retains local
          cached and queued work.
        </InfoCard>
      ) : (
        <AboutCard />
      )}
      <ConfirmModal
        confirmLabel="Forget connection"
        description="This removes the pairing credential from this phone. Local cached and unsynced work is retained and will not upload until it is safely recreated."
        destructive
        onCancel={() => setConfirmForget(false)}
        onConfirm={() => {
          setConfirmForget(false);
          onForget();
        }}
        title="Forget this connection?"
        visible={confirmForget}
      />
      <ConfirmModal
        confirmLabel="Revoke"
        description={`${deviceToRevoke?.name ?? "This device"} will no longer be able to sync.`}
        destructive
        onCancel={() => setDeviceToRevoke(null)}
        onConfirm={() => void revoke()}
        title="Revoke device?"
        visible={Boolean(deviceToRevoke)}
      />
    </View>
  );
}

export function RemoteBackupCard({
  destination,
}: {
  destination: BackupDestinationStatus | null;
}) {
  const status = remoteBackupPresentation(destination);
  return (
    <View
      accessibilityLabel={`Remote backup, ${status}`}
      style={styles.settingsCard}
    >
      <Cloud color="#4f46e5" size={22} />
      <Text style={styles.settingsSectionTitle}>Remote Backup</Text>
      <Text style={styles.settingsValue}>
        {destination?.display_name ?? "Dropbox"}
      </Text>
      <Text
        style={
          destination?.needs_attention
            ? styles.settingsDangerText
            : styles.settingsActive
        }
      >
        {status}
      </Text>
      {destination?.last_successful_backup_at ? (
        <Text style={styles.settingsMeta}>
          Last successful backup:{" "}
          {new Date(destination.last_successful_backup_at).toLocaleString()}
        </Text>
      ) : null}
      {destination?.needs_attention ? (
        <Text style={styles.settingsMeta}>
          Reconnect from WhereHouse web settings.
        </Text>
      ) : null}
      <Text style={styles.settingsMeta}>
        Protects this entire WhereHouse instance.
      </Text>
    </View>
  );
}

function WorkspaceDetail({
  devices,
  workspace,
  isActive,
  me,
  onPair,
  onRevoke,
  onSwitch,
  pairing,
}: {
  devices: Device[];
  workspace: Workspace;
  isActive: boolean;
  me: MeResponse | null;
  onPair: () => Promise<void>;
  onRevoke: (device: Device) => void | Promise<void>;
  onSwitch: () => Promise<void>;
  pairing: PairingSession | null;
}) {
  const role = me?.workspaces.find(
    (entry) => entry.workspace_id === workspace.id,
  )?.role;
  return (
    <>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Relationship</Text>
        <Text style={styles.settingsValue}>{role ?? "member"}</Text>
        {!isActive ? (
          <Pressable
            onPress={() => void onSwitch()}
            style={styles.settingsPrimary}
          >
            <Text style={styles.settingsPrimaryText}>
              Switch to this household
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.settingsActive}>Active household</Text>
        )}
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsSectionTitle}>Connected Devices</Text>
        {role !== "owner" ? (
          <Text style={styles.settingsMeta}>
            Only owners can manage connected devices.
          </Text>
        ) : (
          <>
            <Pressable
              onPress={() => void onPair()}
              style={styles.settingsPrimary}
            >
              <Plus color="#fff" size={18} />
              <Text style={styles.settingsPrimaryText}>
                Pair another device
              </Text>
            </Pressable>
            {pairing ? (
              <>
                <Text selectable style={styles.settingsPairingCode}>
                  {pairing.pairing_uri}
                </Text>
                <Text style={styles.settingsMeta}>
                  Use this one-time link on the new device before{" "}
                  {new Date(pairing.expires_at).toLocaleTimeString()}.
                </Text>
              </>
            ) : null}
            {devices.length ? (
              devices.map((device) => (
                <View key={device.id} style={styles.settingsDevice}>
                  {device.device_type === "phone" ? (
                    <Smartphone color="#4f46e5" size={20} />
                  ) : (
                    <Laptop color="#4f46e5" size={20} />
                  )}
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowText}>{device.name}</Text>
                    <Text style={styles.settingsMeta}>
                      {device.device_type} ·{" "}
                      {device.is_active ? "Active" : "Revoked"}
                      {device.id === me?.device_id ? " · This device" : ""}
                    </Text>
                  </View>
                  {device.is_active && device.id !== me?.device_id ? (
                    <Pressable
                      accessibilityLabel={`Revoke ${device.name}`}
                      onPress={() => void onRevoke(device)}
                    >
                      <Text style={styles.settingsDangerText}>Revoke</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.settingsMeta}>No paired devices yet.</Text>
            )}
          </>
        )}
      </View>
    </>
  );
}

function InfoCard({
  children,
  icon,
  title,
}: {
  children: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.settingsCard}>
      {icon}
      <Text style={styles.settingsSectionTitle}>{title}</Text>
      <Text style={styles.settingsMeta}>{children}</Text>
    </View>
  );
}

function AboutCard() {
  return (
    <View style={styles.settingsCard}>
      <Image
        accessibilityLabel="WhereHouse"
        resizeMode="contain"
        source={require("../../../../web/public/logo.png")}
        style={styles.settingsLogo}
      />
      <Text style={styles.settingsSectionTitle}>WhereHouse</Text>
      <Text style={styles.settingsMeta}>
        Local-first household inventory and spatial organization.
      </Text>
    </View>
  );
}
