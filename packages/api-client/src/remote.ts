import { apiRequest, type ApiOptions } from './client'
import { uploadItemImage } from './resources/items'
import type { Area, ContainerPlacement, IdentifierMedium, IdentifierResolution, IdentifierTargetType, Item, ItemPlacement, ItemSearchResult, PhysicalIdentifier, StorageContainer, Zone } from './types'

export function createRemoteClient(baseUrl: string, token: string) {
  const authenticatedRequest = <T>(path: string, options: ApiOptions = {}) =>
    apiRequest<T>(path, { ...options, baseUrl, token })

  return {
    createIdentifier: (targetType: IdentifierTargetType, targetId: string, medium: IdentifierMedium) => authenticatedRequest<PhysicalIdentifier>('/identifiers', { method: 'POST', body: { target_type: targetType, target_id: targetId, medium } }),
    activateIdentifier: (identifierId: string) => authenticatedRequest<PhysicalIdentifier>(`/identifiers/${identifierId}/activate`, { method: 'POST' }),
    resolveIdentifier: (publicId: string) => authenticatedRequest<IdentifierResolution>(`/identifiers/${encodeURIComponent(publicId)}/resolve`),
    listAreas: (householdId: string) =>
      authenticatedRequest<Area[]>(`/households/${householdId}/areas`),
    listZones: (areaId: string) => authenticatedRequest<Zone[]>(`/areas/${areaId}/zones`),
    listContainers: (areaId: string) =>
      authenticatedRequest<StorageContainer[]>(`/areas/${areaId}/containers`),
    listContainerPlacements: (areaId: string) =>
      authenticatedRequest<ContainerPlacement[]>(`/areas/${areaId}/container-placements`),
    getContainerByCode: (code: string) =>
      authenticatedRequest<StorageContainer>(`/containers/by-code/${encodeURIComponent(code)}`),
    createItem: (householdId: string, payload: {
      client_operation_id?: string
      name: string
      identifier_type: Item['identifier_type']
      description?: string
      quantity: number
      unit?: string
      manufacturer?: string
      model?: string
      serial_number?: string
      notes?: string
    }) => authenticatedRequest<Item>(`/households/${householdId}/items`, { method: 'POST', body: payload }),
    listItems: (householdId: string) => authenticatedRequest<Item[]>(`/households/${householdId}/items`),
    searchItems: (householdId: string, query: string) => authenticatedRequest<ItemSearchResult[]>(`/households/${householdId}/items/search?q=${encodeURIComponent(query)}`),
    listItemPlacements: (householdId: string) => authenticatedRequest<ItemPlacement[]>(`/households/${householdId}/item-placements`),
    updateItem: (itemId: string, payload: {
      name: string
      identifier_type: Item['identifier_type']
      description?: string
      quantity: number
      unit?: string
      manufacturer?: string
      model?: string
      serial_number?: string
      notes?: string
    }) => authenticatedRequest<Item>(`/items/${itemId}`, { method: 'PATCH', body: payload }),
    deleteItem: (itemId: string) =>
      authenticatedRequest<void>(`/items/${itemId}`, { method: 'DELETE' }),
    placeItem: (itemId: string, payload: { area_id?: string; zone_id?: string; container_id?: string; relationship_type?: ContainerPlacement['relationship_type'] }) =>
      authenticatedRequest<ItemPlacement>(`/items/${itemId}/placement`, { method: 'PUT', body: payload }),
    uploadItemImage: (itemId: string, image: Blob, contentType?: string) =>
      uploadItemImage(token, itemId, image, { baseUrl, contentType }),
  }
}
