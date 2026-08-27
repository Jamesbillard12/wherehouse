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

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, token, ...requestOptions } = options
  const response = await fetch(`/api/${API_VERSION}${path}`, {
    ...requestOptions,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(payload?.detail ?? `WhereHouse request failed (${response.status}).`)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export function register(payload: {
  email: string
  display_name: string
  password: string
}): Promise<AccessToken> {
  return apiRequest('/auth/register', { method: 'POST', body: payload })
}

export function login(payload: { email: string; password: string }): Promise<AccessToken> {
  return apiRequest('/auth/login', { method: 'POST', body: payload })
}

export function logout(token: string): Promise<void> {
  return apiRequest('/auth/logout', { method: 'POST', token })
}

export function getMe(token: string): Promise<MeResponse> {
  return apiRequest('/auth/me', { token })
}

export function listHouseholds(token: string): Promise<Household[]> {
  return apiRequest('/households', { token })
}

export function createHousehold(token: string, name: string): Promise<Household> {
  return apiRequest('/households', { method: 'POST', token, body: { name } })
}

export function createPairingSession(
  token: string,
  householdId: string,
  payload: { instance_name: string; instance_type: 'local' | 'cloud' },
): Promise<PairingSession> {
  return apiRequest(`/households/${householdId}/pairing-sessions`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export function listDevices(token: string, householdId: string): Promise<Device[]> {
  return apiRequest(`/households/${householdId}/devices`, { token })
}

export function revokeDevice(token: string, deviceId: string): Promise<void> {
  return apiRequest(`/devices/${deviceId}`, { method: 'DELETE', token })
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
