import { apiRequest } from '../client'
import type { ApplianceStorageStatus, ApplianceUpdateStatus, AutomaticUpdatePolicy, RemoteAdministrationStatus, SystemStatus } from '../types'

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

export function getAutomaticUpdatePolicy(token: string, baseUrl?: string) {
  return apiRequest<AutomaticUpdatePolicy>('/system/update/policy', { baseUrl, token })
}

export function setAutomaticUpdatePolicy(token: string, policy: AutomaticUpdatePolicy['policy'], baseUrl?: string) {
  return apiRequest<AutomaticUpdatePolicy>('/system/update/policy', {
    baseUrl, token, method: 'PUT', body: { policy },
  })
}

export function getStorageStatus(token: string, baseUrl?: string) {
  return apiRequest<ApplianceStorageStatus>('/system/storage', { baseUrl, token })
}

export function prepareStorage(token: string, deviceId: string, confirmation: string, baseUrl?: string) {
  return apiRequest<ApplianceStorageStatus>('/system/storage/prepare', { baseUrl, token, method: 'POST',
    body: { device_id: deviceId, expected_device_id: deviceId, confirmation } })
}

export function migrateStorage(token: string, filesystemUuid: string, baseUrl?: string) {
  return apiRequest<ApplianceStorageStatus>('/system/storage/migrate', { baseUrl, token, method: 'POST',
    body: { filesystem_uuid: filesystemUuid } })
}

export function enableNetworkStorage(token: string, username: string, password: string, baseUrl?: string) {
  return apiRequest<ApplianceStorageStatus>('/system/nas/enable', { baseUrl, token, method: 'POST',
    body: { username, password } })
}

export function disableNetworkStorage(token: string, baseUrl?: string) {
  return apiRequest<ApplianceStorageStatus>('/system/nas/disable', { baseUrl, token, method: 'POST' })
}

export function getRemoteAdministrationStatus(token: string, baseUrl?: string) {
  return apiRequest<RemoteAdministrationStatus>('/system/remote-administration', { baseUrl, token })
}

export function enableRemoteAdministration(token: string, publicKey: string, baseUrl?: string) {
  return apiRequest<RemoteAdministrationStatus>('/system/remote-administration/enable', {
    baseUrl, token, method: 'POST', body: { public_key: publicKey },
  })
}

export function disableRemoteAdministration(token: string, baseUrl?: string) {
  return apiRequest<RemoteAdministrationStatus>('/system/remote-administration/disable', {
    baseUrl, token, method: 'POST',
  })
}
