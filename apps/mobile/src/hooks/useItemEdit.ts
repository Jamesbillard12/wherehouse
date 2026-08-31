import type { Item } from '@wherehouse/api-client'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'

import type { ItemLocationChoice, ItemUpdateDraft } from '../types/itemDraft'

export function useItemEdit(item: Item, location?: ItemLocationChoice) {
  const [draft, setDraft] = useState<ItemUpdateDraft>({ itemId: item.id, name: item.name, quantity: Number(item.quantity), identifierType: item.identifier_type, unit: item.unit ?? undefined, manufacturer: item.manufacturer ?? undefined, model: item.model ?? undefined, serialNumber: item.serial_number ?? undefined, description: item.description ?? undefined, notes: item.notes ?? undefined, location, updatedAt: new Date().toISOString() })
  const update = (values: Partial<ItemUpdateDraft>) => setDraft((current) => ({ ...current, ...values, updatedAt: new Date().toISOString() }))

  async function retainPhoto(uri: string, mimeType?: string | null) {
    const directory = `${FileSystem.documentDirectory}pending-item-photos/`
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    const destination = `${directory}update-${item.id}.${extension}`
    await FileSystem.copyAsync({ from: uri, to: destination })
    update({ photoUri: destination, photoMimeType: mimeType ?? 'image/jpeg' })
  }
  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) throw new Error('Camera access is required to photograph an item.')
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 })
    if (!result.canceled) await retainPhoto(result.assets[0].uri, result.assets[0].mimeType)
  }
  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) throw new Error('Photo access is required to choose an item image.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 })
    if (!result.canceled) await retainPhoto(result.assets[0].uri, result.assets[0].mimeType)
  }
  return { capturePhoto, choosePhoto, draft, update }
}
