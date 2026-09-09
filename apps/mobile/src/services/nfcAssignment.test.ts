import { ApiError } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { writeNfcIdentifier } from './nfc'
import { assignNfcTag } from './nfcAssignment'

vi.mock('./nfc', () => ({ writeNfcIdentifier: vi.fn() }))

const newPayload = 'wherehouse://identify/v1/idn_new'
const oldPayload = 'wherehouse://identify/v1/idn_old'

function client() {
  return {
    createIdentifier: vi.fn().mockResolvedValue({ id: 'new-id', payload: newPayload }),
    activateIdentifier: vi.fn().mockResolvedValue({}),
    resolveIdentifier: vi.fn().mockResolvedValue({ identifier: { id: 'old-id', medium: 'nfc' } }),
    revokeIdentifier: vi.fn().mockResolvedValue(undefined),
  }
}

describe('NFC tag assignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('activates the verified replacement before revoking the old identifier', async () => {
    const api = client()
    vi.mocked(writeNfcIdentifier).mockResolvedValue({ previousPayload: oldPayload })

    await expect(assignNfcTag(api, 'item', 'item-1')).resolves.toEqual({ reassigned: true })

    expect(api.resolveIdentifier).toHaveBeenCalledWith('idn_new')
    expect(api.resolveIdentifier).toHaveBeenCalledWith('idn_old')
    expect(api.revokeIdentifier).toHaveBeenCalledWith('old-id')
    expect(api.activateIdentifier.mock.invocationCallOrder[0])
      .toBeLessThan(api.revokeIdentifier.mock.invocationCallOrder[0])
  })

  it('does not revoke the old identifier when writing or verification fails', async () => {
    const api = client()
    vi.mocked(writeNfcIdentifier).mockRejectedValue(new Error('Tag is read-only'))

    await expect(assignNfcTag(api, 'container', 'container-1')).rejects.toThrow('read-only')

    expect(api.activateIdentifier).not.toHaveBeenCalled()
    expect(api.revokeIdentifier).not.toHaveBeenCalled()
  })

  it('does not revoke when rewriting the same identifier', async () => {
    const api = client()
    vi.mocked(writeNfcIdentifier).mockResolvedValue({ previousPayload: newPayload })

    await expect(assignNfcTag(api, 'item', 'item-1')).resolves.toEqual({ reassigned: false })

    expect(api.resolveIdentifier).toHaveBeenCalledWith('idn_new')
    expect(api.revokeIdentifier).not.toHaveBeenCalled()
  })

  it('keeps the verified replacement when the previous identifier is foreign or inactive', async () => {
    const api = client()
    api.resolveIdentifier
      .mockResolvedValueOnce({ identifier: { id: 'new-id', medium: 'nfc' } })
      .mockRejectedValueOnce(new ApiError('Identifier not found', 404))
    vi.mocked(writeNfcIdentifier).mockResolvedValue({ previousPayload: oldPayload })

    await expect(assignNfcTag(api, 'item', 'item-1')).resolves.toEqual({ reassigned: false })

    expect(api.revokeIdentifier).not.toHaveBeenCalled()
  })

  it('reports when the rewritten tag cannot complete previous-identifier cleanup', async () => {
    const api = client()
    api.resolveIdentifier
      .mockResolvedValueOnce({ identifier: { id: 'new-id', medium: 'nfc' } })
      .mockRejectedValueOnce(new Error('Network unavailable'))
    vi.mocked(writeNfcIdentifier).mockResolvedValue({ previousPayload: oldPayload })

    await expect(assignNfcTag(api, 'item', 'item-1')).rejects.toThrow(/rewritten.*could not be checked or revoked/)

    expect(api.activateIdentifier).toHaveBeenCalledWith('new-id')
    expect(api.revokeIdentifier).not.toHaveBeenCalled()
  })

  it('does not revoke the previous identifier unless the new identifier resolves', async () => {
    const api = client()
    api.resolveIdentifier.mockRejectedValue(new ApiError('Identifier not found', 404))
    vi.mocked(writeNfcIdentifier).mockResolvedValue({ previousPayload: oldPayload })

    await expect(assignNfcTag(api, 'item', 'item-1')).rejects.toThrow(/new identifier is not active/)

    expect(api.revokeIdentifier).not.toHaveBeenCalled()
  })
})
