import type { ContainerType } from '@wherehouse/api-client'
import { Box, Building2, Caravan, Hammer, House, TreePine, Warehouse, type LucideIcon } from 'lucide-react'

export const CONTAINER_TYPES: Array<{ value: ContainerType; label: string }> = [
  { value: 'bin', label: 'Bin' },
  { value: 'box', label: 'Box' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'shelving_unit', label: 'Shelving unit' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'toolbox', label: 'Toolbox' },
  { value: 'bag', label: 'Bag' },
  { value: 'case', label: 'Case' },
  { value: 'rack', label: 'Rack' },
  { value: 'hook', label: 'Hook' },
  { value: 'workbench', label: 'Workbench' },
  { value: 'other', label: 'Other' },
]

export const AREA_ICONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'warehouse', label: 'Garage', icon: Warehouse },
  { value: 'house', label: 'House', icon: House },
  { value: 'building', label: 'Building', icon: Building2 },
  { value: 'tree', label: 'Shed', icon: TreePine },
  { value: 'caravan', label: 'Trailer', icon: Caravan },
  { value: 'hammer', label: 'Workshop', icon: Hammer },
  { value: 'box', label: 'Storage', icon: Box },
]

export function AreaIcon({ name }: { name: string }) {
  const Icon = AREA_ICONS.find((option) => option.value === name)?.icon ?? Warehouse
  return <Icon aria-hidden="true" />
}

export function AreaIconPicker({ defaultValue = 'warehouse' }: { defaultValue?: string }) {
  return (
    <fieldset className="icon-picker">
      <legend>Icon</legend>
      <div>
        {AREA_ICONS.map((option) => (
          <label key={option.value} title={option.label}>
            <input defaultChecked={option.value === defaultValue} name="icon" type="radio" value={option.value} />
            <span><AreaIcon name={option.value} /></span>
            <small>{option.label}</small>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
