import { apiRequest, type ApiOptions } from './client'
import type { Area, ContainerPlacement, StorageContainer, Zone } from './types'

export function createRemoteClient(baseUrl: string, token: string) {
  const authenticatedRequest = <T>(path: string, options: ApiOptions = {}) =>
    apiRequest<T>(path, { ...options, baseUrl, token })

  return {
    listAreas: (householdId: string) =>
      authenticatedRequest<Area[]>(`/households/${householdId}/areas`),
    listZones: (areaId: string) => authenticatedRequest<Zone[]>(`/areas/${areaId}/zones`),
    listContainers: (areaId: string) =>
      authenticatedRequest<StorageContainer[]>(`/areas/${areaId}/containers`),
    listContainerPlacements: (areaId: string) =>
      authenticatedRequest<ContainerPlacement[]>(`/areas/${areaId}/container-placements`),
    getContainerByCode: (code: string) =>
      authenticatedRequest<StorageContainer>(`/containers/by-code/${encodeURIComponent(code)}`),
  }
}

