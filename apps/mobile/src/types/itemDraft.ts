export type ItemLocationChoice = {
  id: string
  kind: 'area' | 'zone' | 'container'
  label: string
  detail?: string
}

export type ItemDraft = {
  localId: string
  name: string
  quantity: number
  unit?: string
  manufacturer?: string
  category?: string
  condition?: string
  notes?: string
  tags?: string[]
  photoUri?: string
  photoMimeType?: string
  location?: ItemLocationChoice
  createdAt: string
}

export type ItemUpdateDraft = {
  itemId: string
  name: string
  quantity: number
  identifierType: 'none' | 'qr' | 'nfc' | 'both'
  unit?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  description?: string
  notes?: string
  photoUri?: string
  photoMimeType?: string
  location?: ItemLocationChoice
  updatedAt: string
}

export function newItemDraft(location?: ItemLocationChoice): ItemDraft {
  return {
    localId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    quantity: 1,
    location,
    createdAt: new Date().toISOString(),
  }
}
