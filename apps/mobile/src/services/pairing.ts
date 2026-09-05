import * as SecureStore from 'expo-secure-store'
import { consumePairing } from '@wherehouse/api-client'

const PAIRING_KEY = 'wherehouse.pairing.v1'
const PAIRING_TYPE = 'wherehouse-pairing'
const PAIRING_VERSION = '1'

export type PairedServer = {
  accessToken: string
  baseUrl: string
  deviceId: string
  workspaceId: string
  instanceId: string
  instanceName: string
  pairedWorkspaceId?: string
  userId: string
  status?: 'active' | 'revoked'
  revokedAt?: string
}

type LegacyPairedServer = PairedServer & {
  householdId?: string
  pairedHouseholdId?: string
}

function normalizePairedServer(value: string): PairedServer {
  const stored = JSON.parse(value) as LegacyPairedServer
  const workspaceId = stored.workspaceId ?? stored.householdId
  if (!workspaceId) throw new Error('Stored household connection is missing its identity.')
  return {
    ...stored,
    workspaceId,
    pairedWorkspaceId:
      stored.pairedWorkspaceId ?? stored.pairedHouseholdId ?? workspaceId,
  }
}

export function isPairingUri(value: string): boolean {
  try {
    parsePairingUri(value)
    return true
  } catch {
    return false
  }
}

export function parsePairingUri(value: string): { server: string; token: string } {
  const url = new URL(value.trim())
  if (url.protocol !== 'wherehouse:' || url.hostname !== 'pair') {
    throw new Error('This is not a WhereHouse pairing link.')
  }

  if (url.searchParams.get('type') !== PAIRING_TYPE) {
    throw new Error('This is not a WhereHouse pairing code.')
  }
  if (url.searchParams.get('version') !== PAIRING_VERSION) {
    throw new Error('This pairing code version is not supported. Create a new code and try again.')
  }

  const server = url.searchParams.get('server')?.replace(/\/$/, '')
  const token = url.searchParams.get('token')
  if (!server || !token) {
    throw new Error('The pairing link is incomplete.')
  }

  const serverUrl = new URL(server)
  if (serverUrl.protocol !== 'https:' && serverUrl.protocol !== 'http:') {
    throw new Error('The server URL must use HTTP or HTTPS.')
  }
  if (serverUrl.username || serverUrl.password) {
    throw new Error('The pairing server URL must not contain credentials.')
  }
  const hostname = serverUrl.hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('This pairing code points to this phone, not the WhereHouse server. Configure PUBLIC_BASE_URL with a LAN, .local, or HTTPS address and create a new code.')
  }
  return { server, token }
}

export async function pairDevice(
  pairingUri: string,
  deviceName: string,
): Promise<PairedServer> {
  const { server, token } = parsePairingUri(pairingUri)
  const result = await consumePairing(server, {
    token,
    device_name: deviceName,
    device_type: 'phone',
  })
  const paired: PairedServer = {
    accessToken: result.access_token,
    baseUrl: result.base_url,
    deviceId: result.device_id,
    workspaceId: result.workspace_id,
    instanceId: result.instance_id,
    instanceName: result.instance_name,
    pairedWorkspaceId: result.workspace_id,
    userId: result.user_id,
  }
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(paired))
  return paired
}

export async function loadPairedServer(): Promise<PairedServer | null> {
  const value = await SecureStore.getItemAsync(PAIRING_KEY)
  if (!value) return null
  const server = normalizePairedServer(value)
  return server.status === 'revoked' ? null : server
}

export async function loadStoredPairing(): Promise<PairedServer | null> {
  const value = await SecureStore.getItemAsync(PAIRING_KEY)
  return value ? normalizePairedServer(value) : null
}

export async function savePairedServer(server: PairedServer): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(server))
}

export async function forgetPairedServer(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY)
}

export async function markPairedServerRevoked(server: PairedServer): Promise<PairedServer> {
  const revoked = {
    ...server,
    accessToken: '',
    status: 'revoked' as const,
    revokedAt: new Date().toISOString(),
  }
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(revoked))
  return revoked
}
