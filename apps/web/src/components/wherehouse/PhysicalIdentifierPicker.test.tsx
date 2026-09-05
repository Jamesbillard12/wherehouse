import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PhysicalIdentifierPicker, PhysicalIdentifierSummary } from './PhysicalIdentifierPicker'

describe('PhysicalIdentifierPicker', () => {
  it('renders an accessible group and switches identifier type', async () => {
    render(<PhysicalIdentifierPicker defaultValue="qr" />)
    expect(screen.getByRole('group', { name: 'Physical identifier' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /QR code/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /NFC tag/ }))
    expect(screen.getByRole('radio', { name: /NFC tag/ })).toBeChecked()
  })

  it('explains disabled and invalid states', () => {
    render(<PhysicalIdentifierPicker disabled error="Choose a supported identifier." />)
    const qr = screen.getByRole('radio', { name: /QR code/ })
    expect(qr).toBeDisabled()
    expect(qr).toHaveAttribute('aria-invalid', 'true')
    expect(qr).toHaveAccessibleDescription('Choose a supported identifier.')
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a supported identifier.')
  })
})

describe('PhysicalIdentifierSummary', () => {
  it('presents combined QR and NFC state in text', () => {
    render(<PhysicalIdentifierSummary type="both" />)
    expect(screen.getByText('QR + NFC')).toBeInTheDocument()
  })
})
