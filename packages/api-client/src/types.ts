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

export type BackupDestinationStatus = {
  kind: 'local' | 'remote'
  provider: string
  display_name: string
  state: 'not_configured' | 'connected' | 'needs_attention' | 'unavailable'
  configured: boolean
  needs_attention: boolean
  last_successful_backup_at: string | null
  management: 'web' | 'cli'
  message: string | null
}

export type BackupStatus = {
  scope: 'instance'
  overall: 'protected' | 'backup_due' | 'needs_attention' | 'no_backup_configured'
  destinations: BackupDestinationStatus[]
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
  image_path: string | null
  is_movable: boolean
  is_out_of_space: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type ContainerSearchResult = {
  container: StorageContainer
  resolved_path: string
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
  code: string
  identifier_type: 'none' | 'qr' | 'nfc' | 'both'
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
  resolved_path?: string
  created_at: string
  updated_at: string
}

export type ItemSearchResult = {
  item: Item
  resolved_path: string | null
}

export type IdentifierTargetType = 'item' | 'container'
export type IdentifierMedium = 'qr' | 'nfc'

export type PhysicalIdentifier = {
  id: string
  household_id: string
  public_id: string
  target_type: IdentifierTargetType
  target_id: string
  medium: IdentifierMedium
  status: 'pending' | 'active' | 'revoked'
  payload_version: number
  payload: string
  created_at: string
  updated_at: string
}

export type IdentifierResolution = {
  identifier: PhysicalIdentifier
  item: Item | null
  container: StorageContainer | null
}
