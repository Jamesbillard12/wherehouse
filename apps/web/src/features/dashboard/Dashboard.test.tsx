import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchContainers } from '@wherehouse/api-client'

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  listAreas: vi.fn().mockResolvedValue([]),
  listItems: vi.fn().mockResolvedValue([]),
  listItemPlacements: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue([{ item: { id: 'stove', household_id: 'home', name: 'Camping Stove', code: 'ITM-001', identifier_type: 'none', description: null, quantity: '1', unit: null, manufacturer: 'Coleman', model: null, serial_number: null, notes: null, image_path: null, is_archived: false, created_at: '', updated_at: '' }, resolved_path: 'Garage > North Wall > Shelf > Yellow Bin' }]),
  searchContainers: vi.fn().mockResolvedValue([]),
  subscribeToHousehold: vi.fn().mockReturnValue(() => undefined),
}))

import { Dashboard } from './Dashboard'

const household = { id: 'home', name: 'Home', created_at: '', updated_at: '' }
const user = { user: { id: 'user', display_name: 'Alex Owner', email: 'alex@example.com' }, authenticated_by: 'user_session' as const, device_id: null, households: [{ household_id: 'home', relationship_type: 'owner' as const }] }

describe('Dashboard settings navigation', () => {
  beforeEach(() => history.replaceState({}, '', '/overview'))

  it('opens the user menu, deep-navigates, and keeps device administration off Overview', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    render(<Dashboard household={household} households={[household]} isOwner onCreateHousehold={vi.fn()} onSelect={vi.fn()} onSignOut={signOut} token="token" user={user} />)

    expect(screen.queryByRole('button', { name: 'Pair a device' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
    for (const label of ['Account', 'Households', 'Preferences', 'Data & Privacy', 'About', 'Pair device', 'Sign out']) expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Preferences' }))
    expect(location.pathname).toBe('/settings/preferences')
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument()
  })

  it('searches canonical inventory and opens a result', async () => {
    render(<Dashboard household={household} households={[household]} isOwner onCreateHousehold={vi.fn()} onSelect={vi.fn()} onSignOut={vi.fn()} token="token" user={user} />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search inventory' }), 'camp')
    expect(await screen.findByText('Camping Stove')).toBeInTheDocument()
    expect(screen.getByText('Item · Garage > North Wall > Shelf > Yellow Bin · Coleman')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Camping Stove/ }))
    await waitFor(() => expect(location.pathname).toBe('/items'))
  })

  it('renders and opens a container search result', async () => {
    vi.mocked(searchContainers).mockResolvedValueOnce([{ container: { id: 'bin', area_id: 'garage', zone_id: null, name: 'Yellow Bin', code: 'BIN-001', container_type: 'bin', identifier_type: 'none', description: null, image_path: null, is_movable: true, is_out_of_space: false, is_archived: false, created_at: '', updated_at: '' }, resolved_path: 'Garage > Shelf > Yellow Bin' }])
    render(<Dashboard household={household} households={[household]} isOwner onCreateHousehold={vi.fn()} onSelect={vi.fn()} onSignOut={vi.fn()} token="token" user={user} />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search inventory' }), 'yellow')
    expect(await screen.findByText('Container · Garage > Shelf > Yellow Bin')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Yellow Bin').closest('button')!)
    await waitFor(() => expect(location.pathname).toBe('/locations'))
  })

  it('starts item creation from the sidebar', async () => {
    render(<Dashboard household={household} households={[household]} isOwner onCreateHousehold={vi.fn()} onSelect={vi.fn()} onSignOut={vi.fn()} token="token" user={user} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(location.pathname).toBe('/items')
    expect(await screen.findByRole('heading', { name: 'Add an item' })).toBeInTheDocument()
  })
})
