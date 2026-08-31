import type { Item } from '@wherehouse/api-client'
import { CircleOff, QrCode, Radio } from 'lucide-react'

const OPTIONS = [
  { value: 'qr', label: 'QR code', description: 'Print and scan a label', icon: QrCode },
  { value: 'nfc', label: 'NFC tag', description: 'Tap with a compatible phone', icon: Radio },
  { value: 'both', label: 'Both', description: 'Use QR and NFC together', icon: QrCode },
  { value: 'none', label: 'Neither', description: 'No physical tag', icon: CircleOff },
] as const

export function PhysicalIdentifierPicker({ defaultValue = 'none' }: { defaultValue?: Item['identifier_type'] }) {
  return <fieldset className="identifier-picker"><legend>Physical identifier</legend>{OPTIONS.map((option) => { const Icon = option.icon; return <label key={option.value}><input defaultChecked={defaultValue === option.value} name="identifierType" type="radio" value={option.value} /><span><span className="identifier-option-icons"><Icon aria-hidden="true" />{option.value === 'both' ? <Radio aria-hidden="true" /> : null}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></span></label> })}</fieldset>
}
