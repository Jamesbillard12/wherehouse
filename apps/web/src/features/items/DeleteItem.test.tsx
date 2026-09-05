import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Item } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteItemRequest, getItemImageRequest } = vi.hoisted(() => ({
  deleteItemRequest: vi.fn(),
  getItemImageRequest: vi.fn(),
}))

vi.mock('@wherehouse/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@wherehouse/api-client')>(),
  deleteItem: deleteItemRequest,
  getItemImage: getItemImageRequest,
}))

import { ItemDetailsModal } from './ItemsView'

const item = {
  id: 'item-1',
  workspace_id: 'workspace-1',
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

describe('item details', () => {
  beforeEach(() => {
    deleteItemRequest.mockReset()
    getItemImageRequest.mockReset()
  })

  it('keeps the item image out of dialog track sizing and clipped to its media panel', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:item-image'), revokeObjectURL: vi.fn() })
    getItemImageRequest.mockResolvedValue(new Blob())
    render(<ItemDetailsModal areas={[]} containerPlacements={[]} containers={[]} item={{ ...item, image_path: 'items/item-1.jpg' }} locationLabel="Unplaced" onClose={vi.fn()} onDeleted={vi.fn()} onUpdated={vi.fn()} token="token" zones={[]} />)

    const image = await screen.findByRole('img', { name: 'Cordless drill' })
    expect(screen.getByRole('dialog', { name: 'Cordless drill' })).toHaveClass('block')
    expect(image.parentElement).toHaveClass('item-image-panel')
    expect(image).toHaveClass('absolute', 'inset-0', 'size-full', 'object-cover')
    expect(screen.getByText('Location').compareDocumentPosition(image) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

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

  it('dismisses item details with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ItemDetailsModal areas={[]} containerPlacements={[]} containers={[]} item={item} locationLabel="Unplaced" onClose={onClose} onDeleted={vi.fn()} onUpdated={vi.fn()} token="token" zones={[]} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
