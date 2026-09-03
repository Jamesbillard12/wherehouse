import type { DeviceRevokedEvent } from '@wherehouse/api-client'

import type { PairedServer } from './pairing'

export function isRevocationForConnection(
  server: PairedServer,
  event: DeviceRevokedEvent,
): boolean {
  return event.device_id === server.deviceId
    && (!server.pairedWorkspaceId || event.workspace_id === server.pairedWorkspaceId)
}
