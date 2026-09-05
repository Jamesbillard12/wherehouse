import type { Item, StorageContainer } from '@wherehouse/api-client'
import { ChevronRight, Container, Package, Pencil, Trash2 } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { PhysicalIdentifierSummary } from './PhysicalIdentifierPicker'

export type ContainerContent = {
  container: StorageContainer
  itemQuantity: number
  locationDescription: string
}

export function LocationContentsList({
  containers,
  items,
  onDeleteContainer,
  onDeleteItem,
  onEditContainer,
  onEditItem,
  onOpenContainer,
  onOpenItem,
  onToggleContainerSpace,
  saving,
}: {
  containers: ContainerContent[]
  items: Item[]
  onDeleteContainer: (container: StorageContainer) => void
  onDeleteItem: (item: Item) => void
  onEditContainer: (container: StorageContainer) => void
  onEditItem: (item: Item) => void
  onOpenContainer: (container: StorageContainer) => void
  onOpenItem: (item: Item) => void
  onToggleContainerSpace: (container: StorageContainer) => void
  saving: boolean
}) {
  const headingId = useId()

  return (
    <div className="location-contents-list">
      {containers.length ? (
        <section aria-labelledby={`${headingId}-containers`} className="location-content-group location-content-group-containers">
          <h3 id={`${headingId}-containers`}><span>Containers</span><strong>{containers.length}</strong></h3>
          <div className="container-list">
            {containers.map(({ container, itemQuantity, locationDescription }) => (
              <article className="location-container-row" key={container.id}>
                <div className="location-entry-icon location-container-icon"><Container aria-hidden="true" /></div>
                <Button className="container-copy container-open" onClick={() => onOpenContainer(container)}>
                  <div><strong>{container.name}</strong><span className="type-badge container-kind-badge">Container</span><span className="type-badge">{container.container_type.replace('_', ' ')}</span><span className="type-badge quantity-badge">{itemQuantity} {itemQuantity === 1 ? 'item' : 'items'}</span>{container.identifier_type !== 'none' ? <span className="identifier-badge"><PhysicalIdentifierSummary type={container.identifier_type} /></span> : null}{container.is_out_of_space ? <span className="full-badge">Full</span> : null}</div>
                  <span>{locationDescription}</span>
                </Button>
                <div className="container-actions"><Button aria-label={`Edit ${container.name}`} className="edit-container-button" onClick={() => onEditContainer(container)} title={`Edit ${container.name}`}><Pencil aria-hidden="true" /></Button><Button aria-label={`Delete ${container.name}`} className="delete-container-button" disabled={saving} onClick={() => onDeleteContainer(container)} title={`Delete ${container.name}`}><Trash2 aria-hidden="true" /></Button><Button className="space-button" onClick={() => onToggleContainerSpace(container)}>{container.is_out_of_space ? 'Mark available' : 'Mark full'}</Button><ChevronRight aria-hidden="true" className="location-entry-chevron" /></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {items.length ? (
        <section aria-labelledby={`${headingId}-items`} className="location-content-group location-content-group-items">
          <h3 id={`${headingId}-items`}><span>Items</span><strong>{items.length}</strong></h3>
          <div className="container-list">
            {items.map((item) => (
              <article className="location-item-row" key={item.id}>
                <div className="location-entry-icon location-item-icon"><Package aria-hidden="true" /></div>
                <Button className="container-copy container-open" onClick={() => onOpenItem(item)}>
                  <div><strong>{item.name}</strong><span className="type-badge item-kind-badge">Item</span><span className="type-badge quantity-badge">{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</span></div>
                  <span>{item.description || 'No description'}</span>
                </Button>
                <div className="container-actions"><Button aria-label={`Edit ${item.name}`} className="edit-container-button" onClick={() => onEditItem(item)} title={`Edit ${item.name}`}><Pencil aria-hidden="true" /></Button><Button aria-label={`Delete ${item.name}`} className="delete-container-button" disabled={saving} onClick={() => onDeleteItem(item)} title={`Delete ${item.name}`}><Trash2 aria-hidden="true" /></Button><ChevronRight aria-hidden="true" className="location-entry-chevron" /></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
