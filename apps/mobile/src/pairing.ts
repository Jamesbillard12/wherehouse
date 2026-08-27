import * as SecureStore from 'expo-secure-store'
import { consumePairing } from '@wherehouse/api-client'

const PAIRING_KEY = 'wherehouse.pairing.v1'

export type PairedServer = {
  accessToken: string
  baseUrl: string
  deviceId: string
  householdId: string
  instanceId: string
  instanceName: string
  userId: string
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
    householdId: result.household_id,
    instanceId: result.instance_id,
    instanceName: result.instance_name,
    userId: result.user_id,
  }
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(paired))
  return paired
}

export async function loadPairedServer(): Promise<PairedServer | null> {
  const value = await SecureStore.getItemAsync(PAIRING_KEY)
  return value ? (JSON.parse(value) as PairedServer) : null
}

export async function forgetPairedServer(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY)
}
