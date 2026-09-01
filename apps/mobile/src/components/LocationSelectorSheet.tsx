import { Box, ChevronLeft, ChevronRight, Layers3, MapPin, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'

import type { CachedInventory } from '../services/inventory'
import type { ItemLocationChoice } from '../types/itemDraft'
import { styles } from '../theme/styles'
import { containerLocationChoice } from '../utils/itemLocations'
import { areaLocationChoice, getLocationContents } from '../utils/locationContents'

export function LocationSelectorSheet({ inventory, onClose, onSelect, syncing, visible }: {
  inventory: CachedInventory
  onClose: () => void
  onSelect: (location: ItemLocationChoice) => void
  syncing: boolean
  visible: boolean
}) {
  const [trail, setTrail] = useState<ItemLocationChoice[]>([])
  const current = trail.at(-1)
  const contents = current ? getLocationContents(current, inventory) : null
  const visibleContainers = current?.kind === 'area'
    ? contents?.containers.filter((container) => !container.zone_id)
    : contents?.containers

  useEffect(() => {
    if (visible) setTrail([])
  }, [visible])

  function open(location: ItemLocationChoice) {
    setTrail((existing) => [...existing, location])
  }

  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.locationSelectorBackdrop}>
      <Pressable accessibilityLabel="Close location selector" onPress={onClose} style={styles.locationSelectorDismiss} />
      <View style={styles.locationSelectorSheet}>
        <View style={styles.locationSelectorHeader}><View><Text style={styles.locationSelectorTitle}>{current?.label ?? 'Choose a location'}</Text><Text style={styles.locationSelectorSubtitle}>{current ? current.detail ?? 'Location' : 'Browse areas, zones, and containers.'}</Text></View><Pressable accessibilityLabel="Close location selector" onPress={onClose}><X color="#667085" size={22} /></Pressable></View>
        {current ? <View style={styles.selectorNavigation}><Pressable accessibilityLabel="Back one location level" onPress={() => setTrail((existing) => existing.slice(0, -1))} style={styles.selectorBackButton}><ChevronLeft color="#4f46e5" size={18} /><Text style={styles.locationToolText}>Back</Text></Pressable><Pressable onPress={() => onSelect(current)} style={styles.selectorChooseButton}><Text style={styles.selectorChooseText}>View contents</Text></Pressable></View> : null}
        <ScrollView showsVerticalScrollIndicator={false}>
          {!current ? inventory.areas.map((area) => {
            const areaChoice = areaLocationChoice(area.id, inventory)
            const zones = inventory.zones.filter((zone) => zone.area_id === area.id)
            const areaContainers = inventory.containers.filter((container) => container.area_id === area.id)
            return areaChoice ? <SelectorRow detail={`${zones.length} zones · ${areaContainers.length} containers`} icon="area" key={area.id} label={area.name} onPress={() => open(areaChoice)} /> : null
          }) : null}
          {contents?.childLocations.map((location) => <SelectorRow detail="Zone" icon="zone" key={`${location.kind}:${location.id}`} label={location.label} onPress={() => open(location)} />)}
          {visibleContainers?.map((container) => <SelectorRow detail={`${container.container_type.replace('_', ' ')} · ${container.code}`} icon="container" key={container.id} label={container.name} onPress={() => open(containerLocationChoice(container, inventory))} />)}
          {!current && !inventory.areas.length ? <Text style={styles.emptyInventory}>{syncing ? 'Syncing locations…' : 'No locations yet. Create an area in the web app, then sync.'}</Text> : null}
          {current && !contents?.childLocations.length && !visibleContainers?.length ? <Text style={styles.emptyInventory}>No locations are nested inside {current.label}.</Text> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>
}

function SelectorRow({ detail, icon, label, onPress }: { detail: string; icon: 'area' | 'zone' | 'container'; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Browse ${label}`} onPress={onPress} style={styles.selectorHierarchyRow}>{icon === 'area' ? <MapPin color="#4f46e5" size={20} /> : icon === 'zone' ? <Layers3 color="#667085" size={18} /> : <Box color="#667085" size={18} />}<View style={styles.containerCopy}><Text style={styles.areaName}>{label}</Text><Text style={styles.areaMeta}>{detail}</Text></View><ChevronRight color="#98a2b3" size={18} /></Pressable>
}
