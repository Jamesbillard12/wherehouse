import { ApiError, parseIdentifierPayload } from '@wherehouse/api-client'

import { writeNfcIdentifier } from './nfc'

type NfcClient = {
  activateIdentifier(identifierId: string): Promise<unknown>
  createIdentifier(targetType: 'item' | 'container', targetId: string, medium: 'nfc'): Promise<{
    id: string
    payload: string
  }>
  resolveIdentifier(publicId: string): Promise<{ identifier: { id: string; medium: 'qr' | 'nfc' } }>
  revokeIdentifier(identifierId: string): Promise<void>
}

export async function assignNfcTag(
  client: NfcClient,
  targetType: 'item' | 'container',
  targetId: string,
): Promise<{ reassigned: boolean }> {
  const identifier = await client.createIdentifier(targetType, targetId, 'nfc')
  const { previousPayload } = await writeNfcIdentifier(identifier.payload)
  await client.activateIdentifier(identifier.id)

  if (!previousPayload || previousPayload === identifier.payload) return { reassigned: false }
  const previous = parseIdentifierPayload(previousPayload)
  if (!previous || previous.version !== 1) return { reassigned: false }

  const resolution = await client.resolveIdentifier(previous.publicId).catch((reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 404) return null
    throw new Error('The NFC tag was rewritten, but its previous WhereHouse identifier could not be checked or revoked. Try again while connected.')
  })
  if (!resolution) {
    // The old payload may belong to another server or already be inactive. The verified new tag is valid.
    return { reassigned: false }
  }
  if (resolution.identifier.medium === 'nfc' && resolution.identifier.id !== identifier.id) {
    try {
      await client.revokeIdentifier(resolution.identifier.id)
    } catch {
      throw new Error('The NFC tag was rewritten, but its previous WhereHouse identifier could not be revoked. Try again while connected.')
    }
    return { reassigned: true }
  }
  return { reassigned: false }
}
