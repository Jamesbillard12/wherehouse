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
  const names = [container.name]
  const parentByChild = new Map(inventory.placements.map((entry) => [entry.container_id, entry.parent_container_id]))
  const containerById = new Map(inventory.containers.map((entry) => [entry.id, entry]))
  const visited = new Set([container.id])
  let parentId = parentByChild.get(container.id)
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = containerById.get(parentId)
    if (!parent) break
    names.unshift(parent.name)
    parentId = parentByChild.get(parent.id)
  }
  return { id: container.id, kind: 'container', label: container.name, detail: [area?.name, zone?.name, ...names, container.code].filter(Boolean).join(' > ') }
}

export function placementLocationChoice(placement: ItemPlacement | undefined, inventory: CachedInventory): ItemLocationChoice | undefined {
  if (!placement) return undefined
  const canonicalLabel = placement.resolved_path || undefined
  if (placement.container_id) {
    const container = inventory.containers.find((entry) => entry.id === placement.container_id)
    if (!container) return undefined
    const choice = containerLocationChoice(container, inventory)
    return { ...choice, label: canonicalLabel ?? choice.detail ?? container.name }
  }
  if (placement.zone_id) {
    const zone = inventory.zones.find((entry) => entry.id === placement.zone_id)
    if (zone) return { id: zone.id, kind: 'zone', label: canonicalLabel ?? zone.name, detail: inventory.areas.find((entry) => entry.id === zone.area_id)?.name }
  }
  if (placement.area_id) {
    const area = inventory.areas.find((entry) => entry.id === placement.area_id)
    if (area) return { id: area.id, kind: 'area', label: canonicalLabel ?? area.name, detail: 'Area' }
  }
  return undefined
}
