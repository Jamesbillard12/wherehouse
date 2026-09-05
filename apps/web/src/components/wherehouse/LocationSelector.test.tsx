import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LocationSelector } from './LocationSelector'

const areas = [{ id: 'area-1', name: 'Garage' }]
const zones = [{ id: 'zone-1', area_id: 'area-1', name: 'North wall' }]
const containers = [{ id: 'parent', area_id: 'area-1', zone_id: 'zone-1', name: 'Shelf' }, { id: 'child', area_id: 'area-1', zone_id: 'zone-1', name: 'Bin' }]
const placements = [{ container_id: 'child', parent_container_id: 'parent' }]

describe('LocationSelector', () => {
  it('offers areas, zones, and nested containers with resolved labels', async () => {
    const onChange = vi.fn()
    render(<LocationSelector areas={areas as never} containerPlacements={placements as never} containers={containers as never} onChange={onChange} optional placeholder="Unplaced" zones={zones as never} />)
    const select = screen.getByLabelText(/Location/)
    expect(screen.getByRole('option', { name: 'Garage / North wall / Shelf / Bin' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'container:child')
    expect(onChange).toHaveBeenCalled()
  })

  it('associates validation errors and disables a pending selector', () => {
    render(<LocationSelector areas={[]} containerPlacements={[]} containers={[]} disabled error="Choose another destination." required zones={[]} />)
    expect(screen.getByLabelText('Location')).toBeDisabled()
    expect(screen.getByLabelText('Location')).toHaveAccessibleDescription('Choose another destination.')
    expect(screen.getByRole('option', { name: 'Choose a location' })).toBeDisabled()
  })
})
