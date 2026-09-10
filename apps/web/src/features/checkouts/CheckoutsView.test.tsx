import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CheckoutsView } from './CheckoutsView'

const { borrowerId } = vi.hoisted(() => ({ borrowerId: 'fbf75151-ecfe-4070-b813-e6d51aa15abc' }))

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  getCurrentCheckoutSession: vi.fn().mockResolvedValue({
    id: 'session-1',
    borrower_profile_id: borrowerId,
    borrower_name: 'Erica Billard',
    due_at: null,
    note: null,
    revision: 1,
    items: [],
  }),
  listCheckoutSessions: vi.fn().mockResolvedValue([]),
  listBorrowers: vi.fn().mockResolvedValue([{ id: borrowerId, display_name: 'Erica Billard', email: null, access_type: 'managed' }]),
  listBorrowerInvitations: vi.fn().mockResolvedValue([]),
  listCheckouts: vi.fn().mockResolvedValue([]),
  subscribeToWorkspace: vi.fn().mockReturnValue(() => undefined),
}))

describe('CheckoutsView', () => {
  it('shows the borrower label instead of the stored id', async () => {
    render(<CheckoutsView isOwner token="token" workspace={{ id: 'workspace-1', name: 'Home' } as never} />)

    const select = await screen.findByRole('combobox', { name: 'Borrower' })
    expect(select).toHaveTextContent('Erica Billard · Managed')
    expect(select).not.toHaveTextContent(borrowerId)
  })

  it('separates checkout, returns, history, and borrower workflows into tabs', async () => {
    const user = userEvent.setup()
    render(<CheckoutsView isOwner token="token" workspace={{ id: 'workspace-1', name: 'Home' } as never} />)

    expect(await screen.findByRole('tab', { name: 'Checkout' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Returns' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'History' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Borrowers' }))

    expect(screen.getByRole('tab', { name: 'Borrowers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Erica Billard')).toBeVisible()
    expect(screen.queryByText('Your checkout is empty')).not.toBeInTheDocument()
  })
})
