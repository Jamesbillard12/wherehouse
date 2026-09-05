import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LocationPath, locationPathSegments } from './LocationPath'

describe('LocationPath', () => {
  it('renders a readable resolved path and normalizes API separators', () => {
    render(<LocationPath segments={locationPathSegments('Garage > North wall > Yellow bin')} />)
    expect(screen.getByText('Garage > North wall > Yellow bin')).toHaveAccessibleName('Location: Garage, North wall, Yellow bin')
  })

  it('handles missing path data', () => {
    render(<LocationPath segments={[]} />)
    expect(screen.getByText('Unplaced')).toBeInTheDocument()
  })

  it('renders navigable ancestors and marks the current location', async () => {
    const onNavigate = vi.fn()
    render(<LocationPath onNavigate={onNavigate} segments={[{ id: 'a', label: 'Garage' }, { id: 'c', label: 'Bin' }]} variant="breadcrumb" />)
    await userEvent.click(screen.getByRole('button', { name: 'Garage' }))
    expect(onNavigate).toHaveBeenCalledWith({ id: 'a', label: 'Garage' }, 0)
    expect(screen.getByText('Bin')).toHaveAttribute('aria-current', 'location')
  })
})
