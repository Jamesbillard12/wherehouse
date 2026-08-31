import type { ItemPlacement, StorageContainer } from '@wherehouse/api-client'

import type { CachedInventory } from '../services/inventory'
import type { ItemLocationChoice } from '../types/itemDraft'

export function itemLocationChoices(inventory: CachedInventory): ItemLocationChoice[] {
  const areas = inventory.areas.map((area) => ({ id: area.id, kind: 'area' as const, label: area.name, detail: 'Area' }))
  const zones = inventory.zones.map((zone) => ({ id: zone.id, kind: 'zone' as const, label: zone.name, detail: inventory.areas.find((area) => area.id === zone.area_id)?.name }))
  const containers = inventory.containers.map((container) => containerLocationChoice(container, inventory))
  return [...containers, ...zones, ...areas]
}

export function containerLocationChoice(container: StorageContainer, inventory: CachedInventory): ItemLocationChoice {
  const area = inventory.areas.find((entry) => entry.id === container.area_id)
  const zone = inventory.zones.find((entry) => entry.id === container.zone_id)
  return { id: container.id, kind: 'container', label: container.name, detail: [area?.name, zone?.name, container.code].filter(Boolean).join(' · ') }
}

export function placementLocationChoice(placement: ItemPlacement | undefined, inventory: CachedInventory): ItemLocationChoice | undefined {
  if (!placement) return undefined
  if (placement.container_id) {
    const container = inventory.containers.find((entry) => entry.id === placement.container_id)
    return container ? containerLocationChoice(container, inventory) : undefined
  }
  if (placement.zone_id) {
    const zone = inventory.zones.find((entry) => entry.id === placement.zone_id)
    if (zone) return { id: zone.id, kind: 'zone', label: zone.name, detail: inventory.areas.find((entry) => entry.id === zone.area_id)?.name }
  }
  if (placement.area_id) {
    const area = inventory.areas.find((entry) => entry.id === placement.area_id)
    if (area) return { id: area.id, kind: 'area', label: area.name, detail: 'Area' }
  }
  return undefined
}
