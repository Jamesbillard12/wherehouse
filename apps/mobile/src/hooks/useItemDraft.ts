import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { useState } from 'react'

import { newItemDraft, type ItemDraft, type ItemLocationChoice } from '../types/itemDraft'

export function useItemDraft(initialLocation?: ItemLocationChoice) {
  const [draft, setDraft] = useState<ItemDraft>(() => newItemDraft(initialLocation))

  function update(values: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...values }))
  }

  async function retainPhoto(uri: string, mimeType?: string | null) {
    const directory = `${FileSystem.documentDirectory}pending-item-photos/`
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    const destination = `${directory}${draft.localId}.${extension}`
    await FileSystem.copyAsync({ from: uri, to: destination })
    update({ photoUri: destination, photoMimeType: mimeType ?? 'image/jpeg' })
  }

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) throw new Error('Camera access is required to photograph an item.')
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (!result.canceled) await retainPhoto(result.assets[0].uri, result.assets[0].mimeType)
  }

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) throw new Error('Photo access is required to choose an item image.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (!result.canceled) await retainPhoto(result.assets[0].uri, result.assets[0].mimeType)
  }

  function reset(location = draft.location) {
    setDraft(newItemDraft(location))
  }

  return { capturePhoto, choosePhoto, draft, reset, update }
}
