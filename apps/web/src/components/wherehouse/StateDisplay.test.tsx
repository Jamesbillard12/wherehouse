import { Package, Plus } from 'lucide-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState, StatusMessage } from './StateDisplay'

describe('WhereHouse state displays', () => {
  it('renders empty-state copy, a decorative icon, and optional actions', async () => {
    const onAdd = vi.fn()
    render(<EmptyState action={<Button onClick={onAdd}><Plus />Add item</Button>} description="Track something here." icon={Package} title="No items yet" />)

    expect(screen.getByRole('heading', { name: 'No items yet', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Track something here.')).toBeInTheDocument()
    expect(document.querySelector('.state-display-icon svg')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('announces loading without exposing its spinner', () => {
    render(<LoadingState label="Loading locations…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading locations…')
    expect(document.querySelector('.state-display-spinner')).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces full and inline errors while preserving useful copy', () => {
    render(<><ErrorState description="Check the connection and retry." title="Unable to load items" /><StatusMessage tone="error">Update failed.</StatusMessage></>)
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Unable to load items' })).toBeInTheDocument()
    expect(screen.getByText('Check the connection and retry.')).toBeInTheDocument()
  })

  it('uses status semantics for non-error tones', () => {
    render(<StatusMessage tone="success">Backup complete.</StatusMessage>)
    expect(screen.getByRole('status')).toHaveTextContent('Backup complete.')
    expect(screen.getByRole('status')).toHaveClass('status-message-success')
  })
})
