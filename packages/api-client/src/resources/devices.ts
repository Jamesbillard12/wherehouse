import { apiRequest } from '../client'
import { API_VERSION, type Device, type PairingConsume, type PairingResult, type PairingSession } from '../types'

export function createPairingSession(
  token: string,
  householdId: string,
  payload: { instance_name: string; instance_type: 'local' | 'cloud' },
  baseUrl?: string,
): Promise<PairingSession> {
  return apiRequest(`/households/${householdId}/pairing-sessions`, {
    baseUrl,
    method: 'POST',
    token,
    body: payload,
  })
}

export function listDevices(token: string, householdId: string, baseUrl?: string): Promise<Device[]> {
  return apiRequest(`/households/${householdId}/devices`, { baseUrl, token })
}

export function revokeDevice(token: string, deviceId: string, baseUrl?: string): Promise<void> {
  return apiRequest(`/devices/${deviceId}`, { baseUrl, method: 'DELETE', token })
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
