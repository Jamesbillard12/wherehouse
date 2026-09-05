import type { Item } from '@wherehouse/api-client'
import { CircleOff, QrCode, Radio } from 'lucide-react'

export type PhysicalIdentifierType = Item['identifier_type']

const OPTIONS = [
  { value: 'qr', label: 'QR code', description: 'Print and scan a label', icon: QrCode },
  { value: 'nfc', label: 'NFC tag', description: 'Tap with a compatible phone', icon: Radio },
  { value: 'both', label: 'Both', description: 'Use QR and NFC together', icon: QrCode },
  { value: 'none', label: 'Neither', description: 'No physical tag', icon: CircleOff },
] as const

export function PhysicalIdentifierPicker({ defaultValue = 'none', disabled = false, error, label = 'Physical identifier', name = 'identifierType' }: { defaultValue?: PhysicalIdentifierType; disabled?: boolean; error?: string; label?: string; name?: string }) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} className="identifier-picker" disabled={disabled}>
      <legend>{label}</legend>
      {OPTIONS.map((option) => {
        const Icon = option.icon
        return <label key={option.value}><input aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined} defaultChecked={defaultValue === option.value} name={name} type="radio" value={option.value} /><span><span className="identifier-option-icons"><Icon aria-hidden="true" />{option.value === 'both' ? <Radio aria-hidden="true" /> : null}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></span></label>
      })}
      {error ? <p className="form-error" id={`${name}-error`} role="alert">{error}</p> : null}
    </fieldset>
  )
}

export function PhysicalIdentifierSummary({ type }: { type: PhysicalIdentifierType }) {
  return <span className="physical-identifier-value">{type !== 'nfc' && type !== 'none' ? <QrCode aria-hidden="true" /> : null}{type !== 'qr' && type !== 'none' ? <Radio aria-hidden="true" /> : null}{type === 'none' ? 'Neither' : type === 'both' ? 'QR + NFC' : type.toUpperCase()}</span>
}
