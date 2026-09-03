import { render, screen, waitFor } from '@testing-library/react'
import { ApiError } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const accountRequest = vi.hoisted(() => vi.fn())
const workspacesRequest = vi.hoisted(() => vi.fn())
const systemRequest = vi.hoisted(() => vi.fn())

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  getMe: accountRequest,
  listWorkspaces: workspacesRequest,
  getSystemStatus: systemRequest,
}))

import { App } from './App'
import { ACTIVE_WORKSPACE_KEY, SESSION_KEY } from './shared/utils/storage'

describe('App bootstrap', () => {
  beforeEach(() => {
    sessionStorage.clear()
    accountRequest.mockReset()
    workspacesRequest.mockReset()
    systemRequest.mockReset()
    systemRequest.mockResolvedValue({ ready: true, initialized: false, hostname: 'wherehouse.local', storage: { message: 'Storage is healthy.' } })
  })

  it('does not flash the login screen while restoring a stored session', () => {
    sessionStorage.setItem(SESSION_KEY, 'stored-token')
    accountRequest.mockReturnValue(new Promise(() => {}))
    workspacesRequest.mockReturnValue(new Promise(() => {}))

    render(<App />)

    expect(screen.getByRole('status', { name: 'Loading WhereHouse' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Create your account' })).not.toBeInTheDocument()
    expect(accountRequest).toHaveBeenCalledWith('stored-token')
  })

  it('clears an expired stored session and shows a recovery message', async () => {
    sessionStorage.setItem(SESSION_KEY, 'expired-token')
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, 'workspace-a')
    accountRequest.mockRejectedValue(new ApiError('Invalid credentials', 401))
    workspacesRequest.mockResolvedValue([])

    render(<App />)

    expect(await screen.findByText('Your session expired. Sign in again.')).toBeInTheDocument()
    await waitFor(() => expect(sessionStorage.getItem(SESSION_KEY)).toBeNull())
    expect(localStorage.getItem(ACTIVE_WORKSPACE_KEY)).toBeNull()
  })
})
