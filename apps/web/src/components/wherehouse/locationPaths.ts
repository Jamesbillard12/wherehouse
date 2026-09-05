import type { Area, ContainerPlacement, ItemPlacement, StorageContainer, Zone } from '@wherehouse/api-client'

import type { LocationPathSegment } from './LocationPath'

type Target = { id: string; type: 'area' | 'container' | 'zone' }

export function locationSegmentsForTarget(target: Target | null | undefined, areas: Area[], zones: Zone[], containers: StorageContainer[], placements: ContainerPlacement[]): LocationPathSegment[] {
  if (!target) return []
  if (target.type === 'area') {
    const area = areas.find((entry) => entry.id === target.id)
    return area ? [{ id: area.id, label: area.name }] : []
  }
  if (target.type === 'zone') {
    const zone = zones.find((entry) => entry.id === target.id)
    const area = areas.find((entry) => entry.id === zone?.area_id)
    return [...(area ? [{ id: area.id, label: area.name }] : []), ...(zone ? [{ id: zone.id, label: zone.name }] : [])]
  }

  const leaf = containers.find((entry) => entry.id === target.id)
  if (!leaf) return []
  const area = areas.find((entry) => entry.id === leaf.area_id)
  const zone = zones.find((entry) => entry.id === leaf.zone_id)
  const trail: LocationPathSegment[] = []
  const visited = new Set<string>()
  let cursor: StorageContainer | undefined = leaf
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    trail.unshift({ id: cursor.id, label: cursor.name })
    const parentId = placements.find((entry) => entry.container_id === cursor?.id)?.parent_container_id
    cursor = containers.find((entry) => entry.id === parentId)
  }
  return [...(area ? [{ id: area.id, label: area.name }] : []), ...(zone ? [{ id: zone.id, label: zone.name }] : []), ...trail]
}

export function locationPathForTarget(target: Target | null | undefined, areas: Area[], zones: Zone[], containers: StorageContainer[], placements: ContainerPlacement[]): string {
  return locationSegmentsForTarget(target, areas, zones, containers, placements).map((segment) => segment.label).join(' / ')
}

export function itemLocationSegments(placement: ItemPlacement | undefined, areas: Area[], zones: Zone[], containers: StorageContainer[], containerPlacements: ContainerPlacement[]): LocationPathSegment[] {
  if (!placement) return []
  if (placement.area_id) return locationSegmentsForTarget({ type: 'area', id: placement.area_id }, areas, zones, containers, containerPlacements)
  if (placement.zone_id) return locationSegmentsForTarget({ type: 'zone', id: placement.zone_id }, areas, zones, containers, containerPlacements)
  if (placement.container_id) return locationSegmentsForTarget({ type: 'container', id: placement.container_id }, areas, zones, containers, containerPlacements)
  return []
}

export function itemLocationPath(placement: ItemPlacement | undefined, areas: Area[], zones: Zone[], containers: StorageContainer[], containerPlacements: ContainerPlacement[]): string {
  if (!placement) return 'Unplaced'
  return placement.resolved_path || itemLocationSegments(placement, areas, zones, containers, containerPlacements).map((segment) => segment.label).join(' / ') || 'Unplaced'
}
