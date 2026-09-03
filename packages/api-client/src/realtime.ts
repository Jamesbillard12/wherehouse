import { API_VERSION } from './types'

export type RealtimeEvent = {
  type: 'inventory.changed' | 'identifier.resolved'
  workspace_id: string
  /** @deprecated Use workspace_id. */
  household_id?: string
  entity: 'area' | 'zone' | 'container' | 'container-placement' | 'item' | 'item-placement'
  action: string
  entity_id: string
  source: 'device' | 'user_session'
  occurred_at: string
  area_id?: string
}

export type DeviceRevokedEvent = {
  type: 'device.revoked'
  workspace_id: string
  /** @deprecated Use workspace_id. */
  household_id?: string
  device_id: string
  occurred_at: string
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

function realtimeUrl(baseUrl?: string): string {
  const origin = baseUrl?.replace(/\/$/, '') || (typeof location === 'undefined' ? '' : location.origin)
  return `${origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}/api/${API_VERSION}/realtime`
}

export function subscribeToWorkspace(options: {
  baseUrl?: string
  workspaceId: string
  token: string
  onEvent: (event: RealtimeEvent) => void
  onDeviceRevoked?: (event: DeviceRevokedEvent) => void
  onAuthorizationFailure?: () => void
  onStatus?: (status: RealtimeStatus) => void
  onReady?: () => void
}): () => void {
  let active = true
  let attempt = 0
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  const connect = () => {
    if (!active) return
    options.onStatus?.('connecting')
    socket = new WebSocket(realtimeUrl(options.baseUrl))
    socket.onopen = () => socket?.send(JSON.stringify({ type: 'authenticate', token: options.token, workspace_id: options.workspaceId }))
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(String(data)) as RealtimeEvent | DeviceRevokedEvent | { type: 'realtime.ready' }
      if (message.type === 'realtime.ready') {
        attempt = 0
        options.onStatus?.('connected')
        options.onReady?.()
      } else if (message.type === 'device.revoked') {
        active = false
        options.onDeviceRevoked?.(message)
        socket?.close()
      } else if (message.type === 'inventory.changed' || message.type === 'identifier.resolved') {
        options.onEvent(message)
      }
    }
    socket.onerror = () => socket?.close()
    socket.onclose = (event) => {
      if (!active) return
      if (event.code === 4401 || event.code === 4403) {
        active = false
        options.onStatus?.('disconnected')
        options.onAuthorizationFailure?.()
        return
      }
      options.onStatus?.('disconnected')
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5))
      reconnectTimer = setTimeout(connect, delay)
    }
  }
  connect()
  return () => {
    active = false
    if (reconnectTimer) clearTimeout(reconnectTimer)
    socket?.close()
  }
}

/** @deprecated Use subscribeToWorkspace with workspaceId. */
export function subscribeToHousehold(options: {
  baseUrl?: string
  householdId: string
  token: string
  onEvent: (event: RealtimeEvent) => void
  onDeviceRevoked?: (event: DeviceRevokedEvent) => void
  onAuthorizationFailure?: () => void
  onStatus?: (status: RealtimeStatus) => void
  onReady?: () => void
}): () => void {
  const { householdId, ...rest } = options
  return subscribeToWorkspace({ ...rest, workspaceId: householdId })
}
