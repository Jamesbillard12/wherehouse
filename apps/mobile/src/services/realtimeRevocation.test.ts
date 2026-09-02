import { subscribeToHousehold } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  close = vi.fn()
  send = vi.fn()

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
}

describe('realtime authorization lifecycle', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  it('delivers a targeted revocation and stops reconnecting', () => {
    const revoked = vi.fn()
    subscribeToHousehold({
      baseUrl: 'https://wherehouse.test',
      householdId: 'household-a',
      token: 'device-token',
      onEvent: vi.fn(),
      onDeviceRevoked: revoked,
    })
    const socket = FakeWebSocket.instances[0]
    socket.onmessage?.({ data: JSON.stringify({
      type: 'device.revoked', household_id: 'household-a', device_id: 'device-a', occurred_at: 'now',
    }) })
    socket.onclose?.({ code: 4403 })

    expect(revoked).toHaveBeenCalledWith(expect.objectContaining({ device_id: 'device-a' }))
    expect(socket.close).toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('surfaces rejected reconnect credentials without retrying', () => {
    const unauthorized = vi.fn()
    subscribeToHousehold({
      householdId: 'household-a',
      token: 'revoked-token',
      onEvent: vi.fn(),
      onAuthorizationFailure: unauthorized,
    })
    FakeWebSocket.instances[0].onclose?.({ code: 4401 })

    expect(unauthorized).toHaveBeenCalledOnce()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
