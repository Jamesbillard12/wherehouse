import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PhysicalLabelDialog } from './PhysicalLabelDialog'

describe('PhysicalLabelDialog', () => {
  it('gives a generated QR label useful context and enables printing', () => {
    render(<PhysicalLabelDialog code="BIN-001" name="Camping bin" onClose={vi.fn()} qrCode="data:image/png;base64,qr" />)

    expect(screen.getByRole('img', { name: 'QR code for BIN-001' })).toHaveAttribute('src', 'data:image/png;base64,qr')
    expect(screen.getByText('Camping bin')).toBeInTheDocument()
    expect(screen.getByText('BIN-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print QR label' })).toBeEnabled()
  })

  it('announces generation errors and keeps printing unavailable', () => {
    render(<PhysicalLabelDialog code="BIN-001" error="The QR label could not be generated." name="Camping bin" onClose={vi.fn()} qrCode="" />)

    expect(screen.getByRole('alert')).toHaveTextContent('The QR label could not be generated.')
    expect(screen.getByRole('button', { name: 'Print QR label' })).toBeDisabled()
  })
})
