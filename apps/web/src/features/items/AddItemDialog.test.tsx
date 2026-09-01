import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AddItemDialog } from './ItemsView'

const dialogProps = {
  areas: [],
  containerPlacements: [],
  containers: [],
  saving: false,
  zones: [],
}

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>Add item</button>
      <AddItemDialog {...dialogProps} finalFocus={triggerRef} onOpenChange={setOpen} onSubmit={vi.fn()} open={open} />
    </>
  )
}

describe('AddItemDialog', () => {
  it('moves focus into the dialog and restores it after Escape', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Add item' })
    await user.click(trigger)

    const name = screen.getByRole('textbox', { name: 'Name' })
    await waitFor(() => expect(name).toHaveFocus())

    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(trigger).not.toHaveFocus()
    expect(document.activeElement).toHaveAttribute('data-base-ui-focus-guard')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('dismisses when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(screen.getByRole('button', { name: 'Add item' }))
    fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]')!)
    fireEvent.pointerUp(document.querySelector('[data-slot="dialog-overlay"]')!)
    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('submits entered values and exposes its saving state', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())
    const { rerender } = render(<AddItemDialog {...dialogProps} onOpenChange={vi.fn()} onSubmit={onSubmit} open />)

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Cordless drill')
    await user.click(screen.getByRole('button', { name: 'Create item' }))
    expect(onSubmit).toHaveBeenCalledOnce()

    rerender(<AddItemDialog {...dialogProps} onOpenChange={vi.fn()} onSubmit={onSubmit} open saving />)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
