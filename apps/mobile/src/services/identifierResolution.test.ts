import { ApiError } from '@wherehouse/api-client'
import { describe, expect, it, vi } from 'vitest'

import { resolveIdentifier } from './identifierResolution'

function client() {
  return {
    activatePendingNfcIdentifier: vi.fn().mockResolvedValue({}),
    resolveIdentifier: vi.fn().mockResolvedValue({ identifier: { id: 'identifier-id' } }),
  }
}

describe('identifier resolution', () => {
  it('activates and retries a pending identifier for an NFC scan', async () => {
    const api = client()
    api.resolveIdentifier
      .mockRejectedValueOnce(new ApiError('Identifier not found', 404))
      .mockResolvedValueOnce({ identifier: { id: 'identifier-id' } })

    await expect(resolveIdentifier(api as never, 'idn_pending', true)).resolves.toEqual({
      identifier: { id: 'identifier-id' },
    })

    expect(api.activatePendingNfcIdentifier).toHaveBeenCalledWith('idn_pending')
    expect(api.resolveIdentifier).toHaveBeenCalledTimes(2)
  })

  it('does not activate pending identifiers for QR resolution', async () => {
    const api = client()
    api.resolveIdentifier.mockRejectedValue(new ApiError('Identifier not found', 404))

    await expect(resolveIdentifier(api as never, 'idn_missing')).rejects.toThrow('Identifier not found')

    expect(api.activatePendingNfcIdentifier).not.toHaveBeenCalled()
  })
})
