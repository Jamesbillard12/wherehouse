import * as SecureStore from 'expo-secure-store'
import { consumePairing } from '@wherehouse/api-client'

const PAIRING_KEY = 'wherehouse.pairing.v1'

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
  return value.trim().startsWith('wherehouse://pair?')
}

export function parsePairingUri(value: string): { server: string; token: string } {
  const url = new URL(value.trim())
  if (url.protocol !== 'wherehouse:' || url.hostname !== 'pair') {
    throw new Error('This is not a WhereHouse pairing link.')
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
