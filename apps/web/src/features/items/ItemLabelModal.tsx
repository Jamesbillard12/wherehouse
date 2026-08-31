import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createIdentifier, type Item } from '@wherehouse/api-client'

export function ItemLabelModal({ item, onClose, token }: { item: Item; onClose: () => void; token: string }) {
  const [qrCode, setQrCode] = useState('')
  useEffect(() => { void createIdentifier(token, 'item', item.id, 'qr').then((identifier) => QRCode.toDataURL(identifier.payload, { margin: 1, width: 420 })).then(setQrCode) }, [item.id, token])
  return <div className="dialog-backdrop label-backdrop" role="presentation"><section aria-label={`Print label for ${item.name}`} aria-modal="true" className="item-label-dialog" role="dialog"><div className="item-label-print"><img alt={`QR code for ${item.code}`} src={qrCode} /><strong>{item.name}</strong><span>{item.code}</span></div><div className="label-actions"><button className="secondary-action" onClick={onClose}>Cancel</button><button className="primary-button compact" disabled={!qrCode} onClick={() => window.print()}><Printer aria-hidden="true" /> Print QR label</button></div></section></div>
}
