import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

  it('restores focus after Escape and does not dismiss on an outside press', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Remove</button><ConfirmDialog description="This cannot be undone." onCancel={() => setOpen(false)} onConfirm={vi.fn()} open={open} title="Remove item?" /></>
    }
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Remove' })
    await user.click(trigger)
    expect(screen.getByRole('alertdialog', { name: 'Remove item?' })).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.getByRole('alertdialog', { name: 'Remove item?' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('blocks dismissal and duplicate submission while busy and displays an error', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog busy description="This cannot be undone." error="The action failed." onCancel={onCancel} onConfirm={onConfirm} open title="Delete item?" />)

    expect(screen.getByRole('alert')).toHaveTextContent('The action failed.')
    expect(screen.getByRole('button', { name: 'Confirm…' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm…' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
