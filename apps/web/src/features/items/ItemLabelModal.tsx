import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Item } from '@wherehouse/api-client'

export function ItemLabelModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [qrCode, setQrCode] = useState('')
  useEffect(() => { void QRCode.toDataURL(`wherehouse://item/${encodeURIComponent(item.code)}`, { margin: 1, width: 420 }).then(setQrCode) }, [item.code])
  return <div className="dialog-backdrop label-backdrop" role="presentation"><section aria-label={`Print label for ${item.name}`} aria-modal="true" className="item-label-dialog" role="dialog"><div className="item-label-print"><img alt={`QR code for ${item.code}`} src={qrCode} /><strong>{item.name}</strong><span>{item.code}</span></div><div className="label-actions"><button className="secondary-action" onClick={onClose}>Cancel</button><button className="primary-button compact" disabled={!qrCode} onClick={() => window.print()}><Printer aria-hidden="true" /> Print QR label</button></div></section></div>
}
