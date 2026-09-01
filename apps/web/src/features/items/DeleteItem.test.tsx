import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Item } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteItemRequest = vi.hoisted(() => vi.fn())

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  deleteItem: deleteItemRequest,
}))

import { ItemDetailsModal } from './ItemsView'

const item = {
  id: 'item-1',
  household_id: 'household-1',
  name: 'Cordless drill',
  code: 'ITEM-1',
  identifier_type: 'qr',
  description: null,
  quantity: '1',
  unit: null,
  manufacturer: null,
  model: null,
  serial_number: null,
  notes: null,
  image_path: null,
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} satisfies Item

describe('item archival', () => {
  beforeEach(() => deleteItemRequest.mockReset())

  it('requires confirmation before archiving and removes the selected item', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    deleteItemRequest.mockResolvedValue(undefined)
    render(<ItemDetailsModal areas={[]} containerPlacements={[]} containers={[]} item={item} locationLabel="Unplaced" onClose={vi.fn()} onDeleted={onDeleted} onUpdated={vi.fn()} token="token" zones={[]} />)

    await user.click(screen.getByRole('button', { name: 'Archive Cordless drill' }))

    expect(screen.getByText('Archive Cordless drill?')).toBeInTheDocument()
    expect(deleteItemRequest).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Archive item' }))

    await waitFor(() => expect(deleteItemRequest).toHaveBeenCalledWith('token', 'item-1'))
    expect(onDeleted).toHaveBeenCalledWith('item-1')
  })

  it('can open directly in archive confirmation mode from a row action', () => {
    render(<ItemDetailsModal areas={[]} containerPlacements={[]} containers={[]} initialMode="delete" item={item} locationLabel="Unplaced" onClose={vi.fn()} onDeleted={vi.fn()} onUpdated={vi.fn()} token="token" zones={[]} />)

    expect(screen.getByText('Archive Cordless drill?')).toBeInTheDocument()
  })
})
