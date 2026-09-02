import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import { createIdentifier, type StorageContainer } from '@wherehouse/api-client'
import { PhysicalLabelDialog } from '../../components/wherehouse/PhysicalLabelDialog'

export function ContainerLabelModal({ container, onClose, token }: { container: StorageContainer; onClose: () => void; token: string }) {
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { void createIdentifier(token, 'container', container.id, 'qr').then((identifier) => QRCode.toDataURL(identifier.payload, { margin: 1, width: 420 })).then(setQrCode).catch(() => setError('The QR label could not be generated. Close this dialog and try again.')) }, [container.id, token])
  return <PhysicalLabelDialog code={container.code} error={error} name={container.name} onClose={onClose} qrCode={qrCode} />
}
