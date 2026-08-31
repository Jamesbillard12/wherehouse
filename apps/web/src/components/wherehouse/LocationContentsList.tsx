import type { Item, StorageContainer } from '@wherehouse/api-client'
import { ChevronRight, Container, Package, Pencil, QrCode, Radio, Trash2 } from 'lucide-react'
import { useId } from 'react'

export type ContainerContent = {
  container: StorageContainer
  locationDescription: string
}

export function LocationContentsList({
  containers,
  items,
  onDeleteContainer,
  onEditContainer,
  onOpenContainer,
  onOpenItem,
  onToggleContainerSpace,
  saving,
}: {
  containers: ContainerContent[]
  items: Item[]
  onDeleteContainer: (container: StorageContainer) => void
  onEditContainer: (container: StorageContainer) => void
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
            {containers.map(({ container, locationDescription }) => (
              <article className="location-container-row" key={container.id}>
                <div className="location-entry-icon location-container-icon"><Container aria-hidden="true" /></div>
                <button className="container-copy container-open" onClick={() => onOpenContainer(container)}>
                  <div><strong>{container.name}</strong><span className="type-badge container-kind-badge">Container</span><span className="type-badge">{container.container_type.replace('_', ' ')}</span>{container.identifier_type !== 'none' ? <span className="identifier-badge">{container.identifier_type !== 'nfc' ? <QrCode aria-hidden="true" /> : null}{container.identifier_type !== 'qr' ? <Radio aria-hidden="true" /> : null}{container.identifier_type === 'both' ? 'QR + NFC' : container.identifier_type.toUpperCase()}</span> : null}{container.is_out_of_space ? <span className="full-badge">Full</span> : null}</div>
                  <span>{locationDescription}</span>
                </button>
                <div className="container-actions"><button aria-label={`Edit ${container.name}`} className="edit-container-button" onClick={() => onEditContainer(container)} title={`Edit ${container.name}`}><Pencil aria-hidden="true" /></button><button aria-label={`Delete ${container.name}`} className="delete-container-button" disabled={saving} onClick={() => onDeleteContainer(container)} title={`Delete ${container.name}`}><Trash2 aria-hidden="true" /></button><button className="space-button" onClick={() => onToggleContainerSpace(container)}>{container.is_out_of_space ? 'Mark available' : 'Mark full'}</button><ChevronRight aria-hidden="true" className="location-entry-chevron" /></div>
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
                <button className="container-copy container-open" onClick={() => onOpenItem(item)}>
                  <div><strong>{item.name}</strong><span className="type-badge item-kind-badge">Item</span></div>
                  <span>{item.description || 'No description'}</span>
                </button>
                <div className="location-item-summary"><strong>{Number(item.quantity)}</strong>{item.unit ? <span>{item.unit}</span> : null}<ChevronRight aria-hidden="true" className="location-entry-chevron" /></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
