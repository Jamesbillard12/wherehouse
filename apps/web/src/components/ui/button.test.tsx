import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  it('exposes and disables a pending action', () => {
    render(<Button pending>Saving…</Button>)

    const button = screen.getByRole('button', { name: 'Saving…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('data-pending', 'true')
  })

  it('preserves an explicitly disabled state when not pending', () => {
    render(<Button disabled>Unavailable</Button>)

    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  })
})
