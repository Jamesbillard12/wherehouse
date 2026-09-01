import type { Item } from '@wherehouse/api-client'
import { Box, ChevronLeft, ChevronRight, Layers3, MapPin, Package, PackagePlus, Radio, RefreshCw } from 'lucide-react-native'
import { type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { CachedInventory } from '../services/inventory'
import type { ItemLocationChoice } from '../types/itemDraft'
import { styles } from '../theme/styles'
import { containerLocationChoice } from '../utils/itemLocations'
import { getLocationContents, getParentLocation, itemQuantityInContainer } from '../utils/locationContents'

export function LocationsScreen({ error, inventory, onAddItem, onChangeLocation, onOpenItem, onRefresh, onSelect, onWriteNfc, selected, syncing }: {
  error: string | null
  inventory: CachedInventory
  onAddItem: (location: ItemLocationChoice) => void
  onChangeLocation: () => void
  onOpenItem: (item: Item) => void
  onRefresh: () => void
  onSelect: (location: ItemLocationChoice) => void
  onWriteNfc: (containerId: string) => Promise<void>
  selected: ItemLocationChoice | null
  syncing: boolean
}) {
  const contents = selected ? getLocationContents(selected, inventory) : null
  const parent = selected ? getParentLocation(selected, inventory) : undefined
  const selectedContainer = selected?.kind === 'container' ? inventory.containers.find((entry) => entry.id === selected.id) : undefined

  return <View style={styles.locationPanel}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.locationHeadingCopy}><Text style={styles.eyebrow}>Active location</Text><Text style={styles.locationHeading}>{selected?.label ?? 'Choose a location'}</Text>{selected?.detail ? <Text style={styles.description}>{selected.detail}</Text> : null}</View>
        <Pressable accessibilityLabel="Sync locations" disabled={syncing} onPress={onRefresh} style={styles.refreshButton}><RefreshCw color="#4f46e5" size={18} /></Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.locationToolbar}>
        {parent ? <Pressable accessibilityLabel={`Back to ${parent.label}`} onPress={() => onSelect(parent)} style={styles.locationToolButton}><ChevronLeft color="#4f46e5" size={17} /><Text numberOfLines={1} style={styles.locationToolText}>{parent.label}</Text></Pressable> : <View />}
        <Pressable onPress={onChangeLocation} style={styles.locationToolButton}><MapPin color="#4f46e5" size={16} /><Text style={styles.locationToolText}>Change location</Text></Pressable>
      </View>

      {selected && contents ? <>
        <View style={styles.locationSummary}><View><Text style={styles.locationSummaryCount}>{contents.childLocations.length + contents.containers.length}</Text><Text style={styles.locationSummaryLabel}>Locations</Text></View><View style={styles.locationSummaryDivider} /><View><Text style={styles.locationSummaryCount}>{contents.items.length}</Text><Text style={styles.locationSummaryLabel}>Items</Text></View></View>
        {contents.childLocations.length ? <LocationGroup count={contents.childLocations.length} title="Zones">{contents.childLocations.map((location) => <LocationRow detail="Zone" icon="zone" key={`${location.kind}:${location.id}`} label={location.label} onPress={() => onSelect(location)} />)}</LocationGroup> : null}
        {contents.containers.length ? <LocationGroup count={contents.containers.length} title="Containers">{contents.containers.map((container) => <LocationRow detail={[container.container_type.replace('_', ' '), `${itemQuantityInContainer(container.id, inventory)} items`, container.is_out_of_space ? 'Full' : null].filter(Boolean).join(' · ')} icon="container" key={container.id} label={container.name} onPress={() => onSelect(containerLocationChoice(container, inventory))} />)}</LocationGroup> : null}
        {contents.items.length ? <LocationGroup count={contents.items.length} title="Items">{contents.items.map((item) => <Pressable accessibilityLabel={`Open ${item.name}`} key={item.id} onPress={() => onOpenItem(item)} style={styles.locationContentRow}><View style={[styles.locationRowIcon, styles.locationItemIcon]}><Package color="#4f46e5" size={19} /></View><View style={styles.containerCopy}><Text style={styles.containerName}>{item.name}</Text><Text numberOfLines={2} style={styles.containerMeta}>{[Number(item.quantity) + (item.unit ? ` ${item.unit}` : ''), item.description || 'No description'].join(' · ')}</Text></View><ChevronRight color="#98a2b3" size={18} /></Pressable>)}</LocationGroup> : null}
        {!contents.childLocations.length && !contents.containers.length && !contents.items.length ? <View style={styles.locationEmpty}><Layers3 color="#98a2b3" size={30} /><Text style={styles.locationEmptyTitle}>{selected.label} is empty</Text><Text style={styles.emptyInventory}>Add an item here or choose another location.</Text></View> : null}
        <Pressable onPress={() => onAddItem(selected)} style={styles.addToContainerButton}><PackagePlus color="#fff" size={18} /><Text style={styles.addToContainerText}>Add item here</Text></Pressable>
        {selectedContainer ? <Pressable accessibilityLabel={`Write NFC tag for ${selectedContainer.name}`} onPress={() => void onWriteNfc(selectedContainer.id)} style={[styles.secondaryButton, styles.locationNfcButton]}><Radio color="#4f46e5" size={18} /><Text style={styles.secondaryButtonText}>Write and verify NFC tag</Text></Pressable> : null}
      </> : <Text style={styles.emptyInventory}>Choose an area, zone, or container to see what is stored there.</Text>}
    </View>
}

function LocationGroup({ children, count, title }: { children: ReactNode; count: number; title: string }) {
  return <View style={styles.locationGroup}><View style={styles.locationGroupHeading}><Text style={styles.locationGroupTitle}>{title}</Text><Text style={styles.locationGroupCount}>{count}</Text></View>{children}</View>
}

function LocationRow({ detail, icon, label, onPress }: { detail: string; icon: 'container' | 'zone'; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Open ${label}`} onPress={onPress} style={styles.locationContentRow}><View style={styles.locationRowIcon}>{icon === 'zone' ? <Layers3 color="#4f46e5" size={19} /> : <Box color="#4f46e5" size={19} />}</View><View style={styles.containerCopy}><Text style={styles.containerName}>{label}</Text><Text style={styles.containerMeta}>{detail}</Text></View><ChevronRight color="#98a2b3" size={18} /></Pressable>
}
