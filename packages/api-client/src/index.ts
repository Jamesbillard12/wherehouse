export const API_VERSION = 'v1'

export type AccessToken = {
  access_token: string
  token_type: 'bearer'
  expires_at: string | null
}

export type AuthUser = {
  id: string
  email: string
  display_name: string
}

export type HouseholdAccess = {
  household_id: string
  relationship_type: 'owner' | 'borrower'
}

export type MeResponse = {
  user: AuthUser
  authenticated_by: 'user_session' | 'device'
  device_id: string | null
  households: HouseholdAccess[]
}

export type Household = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type Device = {
  id: string
  household_id: string
  user_id: string
  name: string
  device_type: 'phone' | 'tablet' | 'scanner' | 'browser' | 'other'
  last_seen_at: string | null
  is_active: boolean
  created_at: string
  revoked_at: string | null
}

export type PairingSession = {
  id: string
  token: string
  pairing_uri: string
  expires_at: string
}

export type PairingConsume = {
  token: string
  device_name: string
  device_type: Device['device_type']
}

export type PairingResult = AccessToken & {
  base_url: string
  device_id: string
  household_id: string
  instance_id: string
  instance_name: string
  user_id: string
}

export type Area = {
  id: string
  household_id: string
  name: string
  icon: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Zone = {
  id: string
  area_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type ContainerType =
  | 'bin'
  | 'box'
  | 'shelf'
  | 'shelving_unit'
  | 'cabinet'
  | 'drawer'
  | 'toolbox'
  | 'bag'
  | 'case'
  | 'rack'
  | 'hook'
  | 'workbench'
  | 'other'

export type StorageContainer = {
  id: string
  area_id: string
  zone_id: string | null
  name: string
  code: string
  container_type: ContainerType
  identifier_type: 'none' | 'qr' | 'nfc' | 'both'
  description: string | null
  is_movable: boolean
  is_out_of_space: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type ContainerPlacement = {
  id: string
  container_id: string
  parent_container_id: string
  relationship_type: 'in' | 'on' | 'under' | 'attached_to'
  position: number | null
  created_at: string
  updated_at: string
}

export type Item = {
  id: string
  household_id: string
  name: string
  description: string | null
  quantity: string
  unit: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  notes: string | null
  image_path: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type ItemPlacement = {
  id: string
  item_id: string
  area_id: string | null
  zone_id: string | null
  container_id: string | null
  relationship_type: ContainerPlacement['relationship_type'] | null
  created_at: string
  updated_at: string
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  baseUrl?: string
  body?: unknown
  token?: string
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { baseUrl, body, headers, token, ...requestOptions } = options
  const apiBase = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/${API_VERSION}` : `/api/${API_VERSION}`
  const response = await fetch(`${apiBase}${path}`, {
    ...requestOptions,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(payload?.detail ?? `WhereHouse request failed (${response.status}).`)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export function register(payload: {
  email: string
  display_name: string
  password: string
}): Promise<AccessToken> {
  return apiRequest('/auth/register', { method: 'POST', body: payload })
}

export function login(payload: { email: string; password: string }): Promise<AccessToken> {
  return apiRequest('/auth/login', { method: 'POST', body: payload })
}

export function logout(token: string): Promise<void> {
  return apiRequest('/auth/logout', { method: 'POST', token })
}

export function getMe(token: string): Promise<MeResponse> {
  return apiRequest('/auth/me', { token })
}

export function listHouseholds(token: string): Promise<Household[]> {
  return apiRequest('/households', { token })
}

export function createHousehold(token: string, name: string): Promise<Household> {
  return apiRequest('/households', { method: 'POST', token, body: { name } })
}

export function listAreas(token: string, householdId: string): Promise<Area[]> {
  return apiRequest(`/households/${householdId}/areas`, { token })
}

export function createArea(
  token: string,
  householdId: string,
  payload: { name: string; icon: string; description?: string },
): Promise<Area> {
  return apiRequest(`/households/${householdId}/areas`, { method: 'POST', token, body: payload })
}

export function updateAreaIcon(token: string, areaId: string, icon: string): Promise<Area> {
  return apiRequest(`/areas/${areaId}`, { method: 'PATCH', token, body: { icon } })
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

export function listItems(token: string, householdId: string): Promise<Item[]> {
  return apiRequest(`/households/${householdId}/items`, { token })
}

export function createItem(
  token: string,
  householdId: string,
  payload: {
    name: string
    description?: string
    quantity: number
    unit?: string
    manufacturer?: string
    model?: string
    serial_number?: string
    notes?: string
  },
): Promise<Item> {
  return apiRequest(`/households/${householdId}/items`, { method: 'POST', token, body: payload })
}

export function listItemPlacements(token: string, householdId: string): Promise<ItemPlacement[]> {
  return apiRequest(`/households/${householdId}/item-placements`, { token })
}

export async function uploadItemImage(token: string, itemId: string, image: File): Promise<Item> {
  const response = await fetch(`/api/${API_VERSION}/items/${itemId}/image`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.type },
    body: image,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(payload?.detail ?? `Image upload failed (${response.status}).`)
  }
  return (await response.json()) as Item
}

export async function getItemImage(token: string, itemId: string): Promise<Blob> {
  const response = await fetch(`/api/${API_VERSION}/items/${itemId}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`)
  return response.blob()
}

export function placeItem(
  token: string,
  itemId: string,
  payload: {
    area_id?: string
    zone_id?: string
    container_id?: string
    relationship_type?: ContainerPlacement['relationship_type']
  },
): Promise<ItemPlacement> {
  return apiRequest(`/items/${itemId}/placement`, { method: 'PUT', token, body: payload })
}

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

export function createPairingSession(
  token: string,
  householdId: string,
  payload: { instance_name: string; instance_type: 'local' | 'cloud' },
): Promise<PairingSession> {
  return apiRequest(`/households/${householdId}/pairing-sessions`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export function listDevices(token: string, householdId: string): Promise<Device[]> {
  return apiRequest(`/households/${householdId}/devices`, { token })
}

export function revokeDevice(token: string, deviceId: string): Promise<void> {
  return apiRequest(`/devices/${deviceId}`, { method: 'DELETE', token })
}

export async function consumePairing(
  baseUrl: string,
  payload: PairingConsume,
): Promise<PairingResult> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/${API_VERSION}/pairing/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `Pairing failed (${response.status}).`)
  }
  return (await response.json()) as PairingResult
}
