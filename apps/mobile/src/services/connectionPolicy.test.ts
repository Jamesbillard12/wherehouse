import { describe, expect, it } from 'vitest'

import type { PairedServer } from './pairing'
import { isRevocationForConnection } from './connectionPolicy'

const connection: PairedServer = {
  accessToken: 'secret',
  baseUrl: 'https://wherehouse.test',
  deviceId: 'device-a',
  workspaceId: 'workspace-b',
  pairedWorkspaceId: 'workspace-a',
  instanceId: 'instance-a',
  instanceName: 'Workspace B',
  userId: 'user-a',
}

describe('device revocation targeting', () => {
  it('accepts the current device event even after switching workspaces', () => {
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked',
      device_id: 'device-a',
      workspace_id: 'workspace-a',
      occurred_at: new Date().toISOString(),
    })).toBe(true)
  })

  it('ignores another device and a stale pre-repair workspace identity', () => {
    const occurred_at = new Date().toISOString()
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked', device_id: 'device-b', workspace_id: 'workspace-a', occurred_at,
    })).toBe(false)
    expect(isRevocationForConnection(connection, {
      type: 'device.revoked', device_id: 'device-a', workspace_id: 'old-workspace', occurred_at,
    })).toBe(false)
  })
})
