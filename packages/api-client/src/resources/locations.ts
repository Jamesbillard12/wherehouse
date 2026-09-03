import { apiRequest } from '../client'
import { API_VERSION } from '../types'
import type { Area, ContainerPlacement, ContainerSearchResult, ContainerType, StorageContainer, Zone } from '../types'

export function listAreas(token: string, workspaceId: string): Promise<Area[]> {
  return apiRequest(`/workspaces/${workspaceId}/areas`, { token })
}

export function createArea(
  token: string,
  workspaceId: string,
  payload: { name: string; icon: string; description?: string },
): Promise<Area> {
  return apiRequest(`/workspaces/${workspaceId}/areas`, { method: 'POST', token, body: payload })
}

export function updateArea(
  token: string,
  areaId: string,
  payload: { name?: string; icon?: string; description?: string | null },
): Promise<Area> {
  return apiRequest(`/areas/${areaId}`, { method: 'PATCH', token, body: payload })
}

export function updateAreaIcon(token: string, areaId: string, icon: string): Promise<Area> {
  return updateArea(token, areaId, { icon })
}

export function deleteArea(token: string, areaId: string): Promise<void> {
  return apiRequest(`/areas/${areaId}`, { method: 'DELETE', token })
}

export function listZones(token: string, areaId: string): Promise<Zone[]> {
  return apiRequest(`/areas/${areaId}/zones`, { token })
}

export function createZone(
  token: string,
  areaId: string,
  payload: { name: string; description?: string },
): Promise<Zone> {
  return apiRequest(`/areas/${areaId}/zones`, { method: 'POST', token, body: payload })
}

export function updateZone(
  token: string,
  zoneId: string,
  payload: { name: string; description?: string },
): Promise<Zone> {
  return apiRequest(`/zones/${zoneId}`, { method: 'PATCH', token, body: payload })
}

export function listContainers(token: string, areaId: string): Promise<StorageContainer[]> {
  return apiRequest(`/areas/${areaId}/containers`, { token })
}

export function searchContainers(token: string, workspaceId: string, query: string): Promise<ContainerSearchResult[]> {
  return apiRequest(`/workspaces/${workspaceId}/containers/search?q=${encodeURIComponent(query)}`, { token })
}

export function createContainer(
  token: string,
  payload: {
    area_id: string
    zone_id?: string
    name: string
    container_type: ContainerType
    identifier_type: StorageContainer['identifier_type']
    description?: string
    is_movable: boolean
  },
): Promise<StorageContainer> {
  return apiRequest('/containers', { method: 'POST', token, body: payload })
}

export function updateContainer(
  token: string,
  containerId: string,
  payload: {
    zone_id?: string
    name: string
    identifier_type: StorageContainer['identifier_type']
    description?: string
    is_movable: boolean
  },
): Promise<StorageContainer> {
  return apiRequest(`/containers/${containerId}`, { method: 'PATCH', token, body: payload })
}

export function deleteContainer(token: string, containerId: string): Promise<void> {
  return apiRequest(`/containers/${containerId}`, { method: 'DELETE', token })
}

export async function uploadContainerImage(token: string, containerId: string, image: Blob): Promise<StorageContainer> {
  const response = await fetch(`/api/${API_VERSION}/containers/${containerId}/image`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.type || 'image/jpeg' },
    body: image,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(payload?.detail ?? `Image upload failed (${response.status}).`)
  }
  return response.json() as Promise<StorageContainer>
}

export async function getContainerImage(token: string, containerId: string): Promise<Blob> {
  const response = await fetch(`/api/${API_VERSION}/containers/${containerId}/image`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`)
  return response.blob()
}

export function listContainerPlacements(
  token: string,
  areaId: string,
): Promise<ContainerPlacement[]> {
  return apiRequest(`/areas/${areaId}/container-placements`, { token })
}

export function placeContainer(
  token: string,
  containerId: string,
  payload: {
    parent_container_id: string
    relationship_type: ContainerPlacement['relationship_type']
  },
): Promise<ContainerPlacement> {
  return apiRequest(`/containers/${containerId}/placement`, {
    method: 'PUT',
    token,
    body: payload,
  })
}

export function removeContainerPlacement(token: string, containerId: string): Promise<void> {
  return apiRequest(`/containers/${containerId}/placement`, { method: 'DELETE', token })
}

export function setContainerSpace(
  token: string,
  containerId: string,
  isOutOfSpace: boolean,
): Promise<StorageContainer> {
  return apiRequest(`/containers/${containerId}/space?is_out_of_space=${isOutOfSpace}`, {
    method: 'PATCH',
    token,
  })
}
