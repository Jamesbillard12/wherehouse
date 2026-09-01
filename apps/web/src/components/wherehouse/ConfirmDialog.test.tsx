import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('runs the confirmed action', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog description="This cannot be undone." onCancel={vi.fn()} onConfirm={onConfirm} open title="Delete item?" />)

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('allows cancellation', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog description="This cannot be undone." onCancel={onCancel} onConfirm={vi.fn()} open title="Delete item?" />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })
})
