import { ApiError, type IdentifierResolution, type PhysicalIdentifier } from '@wherehouse/api-client'

type IdentifierClient = {
  activatePendingNfcIdentifier(publicId: string): Promise<PhysicalIdentifier>
  resolveIdentifier(publicId: string): Promise<IdentifierResolution>
}

export async function resolveIdentifier(
  client: IdentifierClient,
  publicId: string,
  recoverPendingNfc = false,
): Promise<IdentifierResolution> {
  try {
    return await client.resolveIdentifier(publicId)
  } catch (reason) {
    if (!recoverPendingNfc || !(reason instanceof ApiError) || reason.status !== 404) throw reason
    await client.activatePendingNfcIdentifier(publicId)
    return client.resolveIdentifier(publicId)
  }
}
