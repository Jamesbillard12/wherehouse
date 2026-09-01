import { apiRequest } from '../client'
import { API_VERSION, type ContainerPlacement, type Item, type ItemPlacement } from '../types'

export function listItems(token: string, householdId: string): Promise<Item[]> {
  return apiRequest(`/households/${householdId}/items`, { token })
}

export function createItem(
  token: string,
  householdId: string,
  payload: {
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
  },
): Promise<Item> {
  return apiRequest(`/households/${householdId}/items`, { method: 'POST', token, body: payload })
}

export function updateItem(
  token: string,
  itemId: string,
  payload: {
    name: string
    identifier_type: Item['identifier_type']
    description?: string
    quantity: number
    unit?: string
    manufacturer?: string
    model?: string
    serial_number?: string
    notes?: string
  },
): Promise<Item> {
  return apiRequest(`/items/${itemId}`, { method: 'PATCH', token, body: payload })
}

export function deleteItem(token: string, itemId: string): Promise<void> {
  return apiRequest(`/items/${itemId}`, { method: 'DELETE', token })
}

export function listItemPlacements(token: string, householdId: string): Promise<ItemPlacement[]> {
  return apiRequest(`/households/${householdId}/item-placements`, { token })
}

export async function uploadItemImage(
  token: string,
  itemId: string,
  image: Blob,
  options: { baseUrl?: string; contentType?: string } = {},
): Promise<Item> {
  const apiBase = options.baseUrl ? `${options.baseUrl.replace(/\/$/, '')}/api/${API_VERSION}` : `/api/${API_VERSION}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${apiBase}/items/${itemId}/image`, {
      method: 'PUT',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': options.contentType || image.type || 'image/jpeg' },
      body: image,
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      throw new Error(payload?.detail ?? `Image upload failed (${response.status}).`)
    }
    return (await response.json()) as Item
  } catch (reason) {
    if (controller.signal.aborted) throw new Error('Image upload timed out.')
    throw reason
  } finally {
    clearTimeout(timeout)
  }
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
