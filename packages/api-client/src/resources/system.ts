import { apiRequest } from '../client'
import type { SystemStatus } from '../types'

export function getSystemStatus(baseUrl?: string): Promise<SystemStatus> {
  return apiRequest('/system/status', { baseUrl })
}
