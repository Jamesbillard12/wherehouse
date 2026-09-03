import { apiRequest } from '../client'
import type { AccessToken, Workspace, MeResponse } from '../types'

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

export function listWorkspaces(token: string, baseUrl?: string): Promise<Workspace[]> {
  return apiRequest('/workspaces', { baseUrl, token })
}

export function createWorkspace(token: string, name: string, baseUrl?: string): Promise<Workspace> {
  return apiRequest('/workspaces', { baseUrl, method: 'POST', token, body: { name } })
}

/** @deprecated Use listWorkspaces. */
export const listHouseholds = listWorkspaces
/** @deprecated Use createWorkspace. */
export const createHousehold = createWorkspace
