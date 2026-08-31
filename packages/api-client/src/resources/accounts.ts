import { apiRequest } from '../client'
import type { AccessToken, Household, MeResponse } from '../types'

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


