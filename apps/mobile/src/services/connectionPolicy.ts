import type { DeviceRevokedEvent } from '@wherehouse/api-client'

import type { PairedServer } from './pairing'

export function isRevocationForConnection(
  server: PairedServer,
  event: DeviceRevokedEvent,
): boolean {
  return event.device_id === server.deviceId
    && (!server.pairedHouseholdId || event.household_id === server.pairedHouseholdId)
}
