import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CheckoutsView } from './CheckoutsView'

const { borrowerId, listCheckoutsMock } = vi.hoisted(() => ({
  borrowerId: 'fbf75151-ecfe-4070-b813-e6d51aa15abc',
  listCheckoutsMock: vi.fn(),
}))

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
  listCheckouts: listCheckoutsMock,
  subscribeToWorkspace: vi.fn().mockReturnValue(() => undefined),
}))

describe('CheckoutsView', () => {
  beforeEach(() => listCheckoutsMock.mockReset().mockResolvedValue([]))

  it('shows the borrower label instead of the stored id', async () => {
    render(<CheckoutsView isOwner token="token" workspace={{ id: 'workspace-1', name: 'Home' } as never} />)

    const select = await screen.findByRole('combobox', { name: 'Borrower' })
    expect(select).toHaveTextContent('Erica Billard · Managed')
    expect(select).not.toHaveTextContent(borrowerId)
  })

  it('separates checkout, returns, history, and borrower workflows into tabs', async () => {
    const user = userEvent.setup()
    render(<CheckoutsView isOwner token="token" workspace={{ id: 'workspace-1', name: 'Home' } as never} />)

    expect(await screen.findByRole('tab', { name: 'Check out' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Your checkout' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'In progress' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Returns' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'History' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'In progress' }))
    expect(screen.getByText('No checkouts in progress')).toBeVisible()
    expect(screen.queryByText('Your checkout is empty')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Borrowers' }))

    expect(screen.getByRole('tab', { name: 'Borrowers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Erica Billard')).toBeVisible()
    expect(screen.queryByText('Your checkout is empty')).not.toBeInTheDocument()
  })

  it('searches returns by item or borrower name', async () => {
    listCheckoutsMock.mockImplementation((_token, _workspaceId, status) => Promise.resolve(status === 'active' ? [
      { id: 'loan-1', item_name: 'Cordless drill', borrower_name: 'Erica Billard', returned_at: null, due_at: null, overdue: false },
      { id: 'loan-2', item_name: 'Camping lantern', borrower_name: 'Sam Rivera', returned_at: null, due_at: null, overdue: false },
    ] : []))
    const user = userEvent.setup()
    render(<CheckoutsView isOwner token="token" workspace={{ id: 'workspace-1', name: 'Home' } as never} />)

    await user.click(await screen.findByRole('tab', { name: /Returns/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search returns' }), 'Erica')

    expect(screen.getByText('Cordless drill')).toBeVisible()
    expect(screen.queryByText('Camping lantern')).not.toBeInTheDocument()
  })
})
