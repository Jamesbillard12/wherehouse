import type { StorageContainer } from "@wherehouse/api-client";
import { Box, MapPin, PackagePlus, Radio, RefreshCw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { CachedInventory } from "../services/inventory";
import { styles } from "../theme/styles";

export function ContainersScreen({
  error,
  inventory,
  onAddItem,
  onRefresh,
  onSelect,
  onWriteNfc,
  selected,
  syncing,
}: {
  error: string | null;
  inventory: CachedInventory;
  onAddItem: (container: StorageContainer) => void;
  onRefresh: () => void;
  onSelect: (container: StorageContainer | null) => void;
  onWriteNfc: (container: StorageContainer) => Promise<void>;
  selected: StorageContainer | null;
  syncing: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.eyebrow}>
          {selected ? "Scanned container" : "Cached inventory"}
        </Text>
        <Pressable
          accessibilityLabel="Sync inventory"
          disabled={syncing}
          onPress={onRefresh}
          style={styles.refreshButton}
        >
          <RefreshCw color="#4f46e5" size={18} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {selected ? (
        <>
          <View style={styles.selectedContainerCard}>
            <View style={styles.containerIcon}>
              <Box color="#4f46e5" size={22} />
            </View>
            <View style={styles.containerCopy}>
              <Text style={styles.containerName}>{selected.name}</Text>
              <Text style={styles.containerMeta}>
                {selected.code} · {selected.container_type.replace("_", " ")}
              </Text>
            </View>
            <Pressable onPress={() => onSelect(null)}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => onAddItem(selected)}
            style={styles.addToContainerButton}
          >
            <PackagePlus color="#fff" size={18} />
            <Text style={styles.addToContainerText}>Add item here</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Write NFC tag for this container"
            onPress={() => void onWriteNfc(selected)}
            style={styles.secondaryButton}
          >
            <Radio color="#4f46e5" size={18} />
            <Text style={styles.secondaryButtonText}>Write and verify NFC tag</Text>
          </Pressable>
        </>
      ) : null}
      {inventory.areas.map((area) => {
        const areaZones = inventory.zones.filter(
          (zone) => zone.area_id === area.id,
        );
        const areaContainers = inventory.containers.filter(
          (container) => container.area_id === area.id,
        );
        return (
          <View key={area.id} style={styles.areaSection}>
            <View style={styles.areaHeading}>
              <MapPin color="#4f46e5" size={18} />
              <View>
                <Text style={styles.areaName}>{area.name}</Text>
                <Text style={styles.areaMeta}>
                  {areaZones.length} zones · {areaContainers.length} containers
                </Text>
              </View>
            </View>
            {areaContainers.map((container) => (
              <Pressable
                key={container.id}
                onPress={() => onSelect(container)}
                style={styles.containerRow}
              >
                <Box color="#667085" size={18} />
                <View style={styles.containerCopy}>
                  <Text style={styles.containerName}>{container.name}</Text>
                  <Text style={styles.containerMeta}>
                    {container.code}
                    {container.zone_id
                      ? ` · ${areaZones.find((zone) => zone.id === container.zone_id)?.name ?? "Zone"}`
                      : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}
      {!inventory.areas.length ? (
        <Text style={styles.emptyInventory}>
          No cached locations yet. Connect to the server and sync.
        </Text>
      ) : null}
    </View>
  );
}
