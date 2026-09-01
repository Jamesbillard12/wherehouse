import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createIdentifier, type StorageContainer } from '@wherehouse/api-client'

export function ContainerLabelModal({ container, onClose, token }: { container: StorageContainer; onClose: () => void; token: string }) {
  const [qrCode, setQrCode] = useState('')
  useEffect(() => { void createIdentifier(token, 'container', container.id, 'qr').then((identifier) => QRCode.toDataURL(identifier.payload, { margin: 1, width: 420 })).then(setQrCode) }, [container.id, token])
  return <div className="dialog-backdrop label-backdrop" role="presentation"><section aria-label={`Print label for ${container.name}`} aria-modal="true" className="item-label-dialog" role="dialog"><div className="item-label-print"><img alt={`QR code for ${container.code}`} src={qrCode} /><strong>{container.name}</strong><span>{container.code}</span></div><div className="label-actions"><button className="secondary-action" onClick={onClose}>Cancel</button><button className="primary-button compact" disabled={!qrCode} onClick={() => window.print()}><Printer aria-hidden="true" /> Print QR label</button></div></section></div>
}
