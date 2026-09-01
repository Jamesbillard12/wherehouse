import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import { createIdentifier, type Item } from '@wherehouse/api-client'
import { PhysicalLabelDialog } from '../../components/wherehouse/PhysicalLabelDialog'

export function ItemLabelModal({ item, onClose, token }: { item: Item; onClose: () => void; token: string }) {
  const [qrCode, setQrCode] = useState('')
  useEffect(() => { void createIdentifier(token, 'item', item.id, 'qr').then((identifier) => QRCode.toDataURL(identifier.payload, { margin: 1, width: 420 })).then(setQrCode) }, [item.id, token])
  return <PhysicalLabelDialog code={item.code} name={item.name} onClose={onClose} qrCode={qrCode} />
}
