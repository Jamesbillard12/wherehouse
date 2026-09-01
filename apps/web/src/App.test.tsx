import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const accountRequest = vi.hoisted(() => vi.fn())
const householdsRequest = vi.hoisted(() => vi.fn())

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  getMe: accountRequest,
  listHouseholds: householdsRequest,
}))

import { App } from './App'
import { SESSION_KEY } from './shared/utils/storage'

describe('App bootstrap', () => {
  beforeEach(() => {
    sessionStorage.clear()
    accountRequest.mockReset()
    householdsRequest.mockReset()
  })

  it('does not flash the login screen while restoring a stored session', () => {
    sessionStorage.setItem(SESSION_KEY, 'stored-token')
    accountRequest.mockReturnValue(new Promise(() => {}))
    householdsRequest.mockReturnValue(new Promise(() => {}))

    render(<App />)

    expect(screen.getByRole('status', { name: 'Loading WhereHouse' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Create your account' })).not.toBeInTheDocument()
    expect(accountRequest).toHaveBeenCalledWith('stored-token')
  })
})
