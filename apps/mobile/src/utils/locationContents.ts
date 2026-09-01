import type { Item, StorageContainer } from '@wherehouse/api-client'

import type { CachedInventory } from '../services/inventory'
import type { ItemLocationChoice } from '../types/itemDraft'
import { containerLocationChoice } from './itemLocations'

export type LocationContents = {
  childLocations: ItemLocationChoice[]
  containers: StorageContainer[]
  items: Item[]
}

export function areaLocationChoice(areaId: string, inventory: CachedInventory): ItemLocationChoice | undefined {
  const area = inventory.areas.find((entry) => entry.id === areaId)
  return area ? { id: area.id, kind: 'area', label: area.name, detail: 'Area' } : undefined
}

export function zoneLocationChoice(zoneId: string, inventory: CachedInventory): ItemLocationChoice | undefined {
  const zone = inventory.zones.find((entry) => entry.id === zoneId)
  if (!zone) return undefined
  return { id: zone.id, kind: 'zone', label: zone.name, detail: inventory.areas.find((entry) => entry.id === zone.area_id)?.name }
}

export function getLocationContents(location: ItemLocationChoice, inventory: CachedInventory): LocationContents {
  const placementByContainer = new Map(inventory.placements.map((placement) => [placement.container_id, placement]))
  const containers = inventory.containers.filter((container) => {
    const parentId = placementByContainer.get(container.id)?.parent_container_id
    if (location.kind === 'container') return parentId === location.id
    if (parentId) return false
    return location.kind === 'zone' ? container.zone_id === location.id : container.area_id === location.id
  })
  const items = inventory.items.filter((item) => {
    if (item.is_archived) return false
    const placement = inventory.itemPlacements.find((entry) => entry.item_id === item.id)
    if (!placement) return false
    if (location.kind === 'container') return placement.container_id === location.id
    if (location.kind === 'zone') return placement.zone_id === location.id
    return placement.area_id === location.id || inventory.zones.some((zone) => zone.area_id === location.id && zone.id === placement.zone_id)
  })
  const childLocations = location.kind === 'area'
    ? inventory.zones.filter((zone) => zone.area_id === location.id).map((zone) => zoneLocationChoice(zone.id, inventory)).filter((entry): entry is ItemLocationChoice => Boolean(entry))
    : []
  return { childLocations, containers, items }
}

export function getParentLocation(location: ItemLocationChoice, inventory: CachedInventory): ItemLocationChoice | undefined {
  if (location.kind === 'area') return undefined
  if (location.kind === 'zone') {
    const zone = inventory.zones.find((entry) => entry.id === location.id)
    return zone ? areaLocationChoice(zone.area_id, inventory) : undefined
  }
  const container = inventory.containers.find((entry) => entry.id === location.id)
  if (!container) return undefined
  const parentId = inventory.placements.find((entry) => entry.container_id === container.id)?.parent_container_id
  if (parentId) {
    const parent = inventory.containers.find((entry) => entry.id === parentId)
    return parent ? containerLocationChoice(parent, inventory) : undefined
  }
  return container.zone_id ? zoneLocationChoice(container.zone_id, inventory) : areaLocationChoice(container.area_id, inventory)
}

export function itemQuantityInContainer(containerId: string, inventory: CachedInventory): number {
  const containedIds = new Set([containerId])
  let changed = true
  while (changed) {
    changed = false
    for (const placement of inventory.placements) {
      if (containedIds.has(placement.parent_container_id) && !containedIds.has(placement.container_id)) {
        containedIds.add(placement.container_id)
        changed = true
      }
    }
  }
  return inventory.items.reduce((total, item) => {
    const placement = inventory.itemPlacements.find((entry) => entry.item_id === item.id)
    return placement?.container_id && containedIds.has(placement.container_id) ? total + Number(item.quantity) : total
  }, 0)
}
