// Generated OpenAPI client code will live in this package.
// Keep application code from duplicating backend request/response types by hand.

export const API_VERSION = 'v1'

export type PairingConsume = {
  token: string
  device_name: string
  device_type: 'phone' | 'tablet' | 'scanner' | 'browser' | 'other'
}

export type PairingResult = {
  access_token: string
  token_type: 'bearer'
  expires_at: string | null
  base_url: string
  device_id: string
  household_id: string
  instance_id: string
  instance_name: string
  user_id: string
}

export async function consumePairing(
  baseUrl: string,
  payload: PairingConsume,
): Promise<PairingResult> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/pairing/consume`, {
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
