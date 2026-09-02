import { describe, expect, it } from 'vitest'

import type { PairedServer } from './pairing'
import { isRevocationForConnection } from './connectionPolicy'

const connection: PairedServer = {
  accessToken: 'secret',
  baseUrl: 'https://wherehouse.test',
  deviceId: 'device-a',
  householdId: 'household-b',
  pairedHouseholdId: 'household-a',
  instanceId: 'instance-a',
  instanceName: 'Household B',
  userId: 'user-a',
}

describe('device revocation targeting', () => {
  it('accepts the current device event even after switching households', () => {
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked',
      device_id: 'device-a',
      household_id: 'household-a',
      occurred_at: new Date().toISOString(),
    })).toBe(true)
  })

  it('ignores another device and a stale pre-repair household identity', () => {
    const occurred_at = new Date().toISOString()
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked', device_id: 'device-b', household_id: 'household-a', occurred_at,
    })).toBe(false)
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked', device_id: 'device-a', household_id: 'old-household', occurred_at,
    })).toBe(false)
  })
})
