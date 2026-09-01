import * as FileSystem from 'expo-file-system/legacy'

import type { Item } from '@wherehouse/api-client'

import type { PairedServer } from './pairing'

export async function cacheItemImage(server: PairedServer, item: Item): Promise<string | undefined> {
  if (!item.image_path || !FileSystem.cacheDirectory) return undefined
  const extension = item.image_path.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
  const destination = `${FileSystem.cacheDirectory}wherehouse-item-${item.id}.${extension}`
  const result = await FileSystem.downloadAsync(
    `${server.baseUrl.replace(/\/$/, '')}/api/v1/items/${item.id}/image`,
    destination,
    { headers: { Authorization: `Bearer ${server.accessToken}` } },
  )
  if (result.status < 200 || result.status >= 300) throw new Error(`Image download failed (${result.status}).`)
  return result.uri
}
