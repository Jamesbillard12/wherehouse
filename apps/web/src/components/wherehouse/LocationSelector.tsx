import type { Area, ContainerPlacement, StorageContainer, Zone } from '@wherehouse/api-client'
import { useId, type ChangeEventHandler, type ReactNode } from 'react'

import { locationPathForTarget } from './locationPaths'

export type LocationSelection = `area:${string}` | `zone:${string}` | `container:${string}` | ''

export function LocationSelector({ areas, containerPlacements, containers, defaultValue, disabled, error, label = 'Location', name = 'placement', onChange, optional = false, placeholder = 'Choose a location', required = false, value, zones }: {
  areas: Area[]
  containerPlacements: ContainerPlacement[]
  containers: StorageContainer[]
  defaultValue?: LocationSelection
  disabled?: boolean
  error?: ReactNode
  label?: string
  name?: string
  onChange?: ChangeEventHandler<HTMLSelectElement>
  optional?: boolean
  placeholder?: string
  required?: boolean
  value?: LocationSelection
  zones: Zone[]
}) {
  const id = useId()
  const errorId = `${id}-error`
  return <>
    <label htmlFor={id}>{label} {optional ? <span className="optional">Optional</span> : null}
      <select aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} defaultValue={value === undefined ? defaultValue : undefined} disabled={disabled} id={id} name={name} onChange={onChange} required={required} value={value}>
        <option disabled={required} value="">{placeholder}</option>
        {areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}
        {zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{locationPathForTarget({ type: 'zone', id: zone.id }, areas, zones, containers, containerPlacements)}</option>)}
        {containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{locationPathForTarget({ type: 'container', id: container.id }, areas, zones, containers, containerPlacements)}</option>)}
      </select>
    </label>
    {error ? <span className="form-error" id={errorId}>{error}</span> : null}
  </>
}
