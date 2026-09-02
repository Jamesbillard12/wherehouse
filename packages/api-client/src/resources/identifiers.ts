import { apiRequest } from '../client'
import type { IdentifierMedium, IdentifierResolution, IdentifierTargetType, PhysicalIdentifier } from '../types'

export function createIdentifier(token: string, targetType: IdentifierTargetType, targetId: string, medium: IdentifierMedium): Promise<PhysicalIdentifier> {
  return apiRequest('/identifiers', { method: 'POST', token, body: { target_type: targetType, target_id: targetId, medium } })
}

export function resolveIdentifier(token: string, publicId: string): Promise<IdentifierResolution> {
  return apiRequest(`/identifiers/${encodeURIComponent(publicId)}/resolve`, { token })
}

export function activateIdentifier(token: string, identifierId: string): Promise<PhysicalIdentifier> {
  return apiRequest(`/identifiers/${encodeURIComponent(identifierId)}/activate`, { method: 'POST', token })
}

export function parseIdentifierPayload(value: string): { publicId: string; version: number } | null {
  const match = value.trim().match(/^wherehouse:\/\/identify\/v(\d+)\/(idn_[A-Za-z0-9_-]+)$/)
  if (!match) return null
  const version = Number(match[1])
  if (!Number.isSafeInteger(version)) return null
  return { version, publicId: match[2] }
}
