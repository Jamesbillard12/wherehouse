import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Item, StorageContainer } from '@wherehouse/api-client'
import { describe, expect, it, vi } from 'vitest'

import { LocationContentsList } from './LocationContentsList'

const container = {
  id: 'container-1',
  name: 'Drawer 1',
  code: 'DRW-1',
  container_type: 'drawer',
  identifier_type: 'both',
  is_out_of_space: false,
} as StorageContainer

const item = {
  id: 'item-1',
  name: 'Cup',
  quantity: '1',
  unit: 'cups',
  description: null,
} as Item

describe('LocationContentsList', () => {
  it('offers matching edit and delete controls while retaining the container space toggle', async () => {
    const user = userEvent.setup()
    const onEditItem = vi.fn()
    const onDeleteItem = vi.fn()
    render(<LocationContentsList containers={[{ container, itemQuantity: 3, locationDescription: 'West Wall' }]} items={[item]} onDeleteContainer={vi.fn()} onDeleteItem={onDeleteItem} onEditContainer={vi.fn()} onEditItem={onEditItem} onOpenContainer={vi.fn()} onOpenItem={vi.fn()} onToggleContainerSpace={vi.fn()} saving={false} />)

    expect(screen.getByRole('button', { name: 'Mark full' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Edit / })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(2)
    expect(screen.getByText('3 items')).toBeInTheDocument()
    expect(screen.getByText('1 cups')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Cup' }))
    await user.click(screen.getByRole('button', { name: 'Delete Cup' }))

    expect(onEditItem).toHaveBeenCalledWith(item)
    expect(onDeleteItem).toHaveBeenCalledWith(item)
  })
})
