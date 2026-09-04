import { apiRequest } from '../client'
import type { ApplianceUpdateStatus, SystemStatus } from '../types'

export function getSystemStatus(baseUrl?: string): Promise<SystemStatus> {
  return apiRequest('/system/status', { baseUrl })
}

export function getUpdateStatus(token: string, baseUrl?: string) {
  return apiRequest<ApplianceUpdateStatus>('/system/update', { baseUrl, token })
}

export function checkForUpdate(token: string, baseUrl?: string) {
  return apiRequest<ApplianceUpdateStatus>('/system/update/check', {
    baseUrl, token, method: 'POST',
  })
}

export function installUpdate(token: string, baseUrl?: string) {
  return apiRequest<ApplianceUpdateStatus>('/system/update/install', {
    baseUrl, token, method: 'POST',
  })
}
