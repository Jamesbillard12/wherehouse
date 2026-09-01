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

export function getMe(token: string, baseUrl?: string): Promise<MeResponse> {
  return apiRequest('/auth/me', { baseUrl, token })
}

export function listHouseholds(token: string, baseUrl?: string): Promise<Household[]> {
  return apiRequest('/households', { baseUrl, token })
}

export function createHousehold(token: string, name: string, baseUrl?: string): Promise<Household> {
  return apiRequest('/households', { baseUrl, method: 'POST', token, body: { name } })
}

