import {
  createItem,
  getItemImage,
  listAreas,
  listContainerPlacements,
  listContainers,
  listItemPlacements,
  listItems,
  listZones,
  placeItem,
  uploadItemImage,
  updateItem,
  type Area,
  type ContainerPlacement,
  type Household,
  type Item,
  type ItemPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import { Box, Camera, Image as ImageIcon, MapPin, PackagePlus, Pencil, Plus, Printer, QrCode, Radio } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { formatDate } from '../../shared/utils/date'
import { message } from '../../shared/utils/errors'
import { PhysicalIdentifierPicker } from './PhysicalIdentifierPicker'
import { ItemLabelModal } from './ItemLabelModal'

export function itemLocation(
  placement: ItemPlacement | undefined,
  areas: Area[],
  zones: Zone[],
  containers: StorageContainer[],
  containerPlacements: ContainerPlacement[],
): string {
  if (!placement) return 'Unplaced'
  if (placement.area_id) return areas.find((area) => area.id === placement.area_id)?.name ?? 'Area'
  if (placement.zone_id) {
    const zone = zones.find((entry) => entry.id === placement.zone_id)
    const area = areas.find((entry) => entry.id === zone?.area_id)
    return [area?.name, zone?.name].filter(Boolean).join(' / ')
  }
  const path: string[] = []
  let container = containers.find((entry) => entry.id === placement.container_id)
  const area = areas.find((entry) => entry.id === container?.area_id)
  const zone = zones.find((entry) => entry.id === container?.zone_id)
  while (container) {
    path.unshift(container.name)
    const parentId = containerPlacements.find((entry) => entry.container_id === container?.id)?.parent_container_id
    container = containers.find((entry) => entry.id === parentId)
  }
  return [area?.name, zone?.name, ...path].filter(Boolean).join(' / ') || 'Unplaced'
}

export function ItemDetailsModal({ areas, containerPlacements, containers, item, locationLabel, onClose, onPlacementUpdated, onUpdated, placement, token, zones }: { areas: Area[]; containerPlacements: ContainerPlacement[]; containers: StorageContainer[]; item: Item; locationLabel: string; onClose: () => void; onPlacementUpdated?: (placement: ItemPlacement) => void; onUpdated: (item: Item) => void; placement?: ItemPlacement; token: string; zones: Zone[] }) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [displayLocation, setDisplayLocation] = useState(locationLabel)

  useEffect(() => setDisplayLocation(locationLabel), [locationLabel])

  useEffect(() => {
    if (!item.image_path) {
      setImageUrl('')
      return
    }
    let active = true
    let objectUrl = ''
    void getItemImage(token, item.id).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setImageUrl(objectUrl)
    }).catch((reason) => active && setImageError(message(reason)))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, item.image_path, token])

  async function changeImage(file: File | undefined) {
    if (!file) return
    setImageBusy(true)
    setImageError(null)
    try {
      const updated = await uploadItemImage(token, item.id, file)
      onUpdated(updated)
    } catch (reason) {
      setImageError(message(reason))
    } finally {
      setImageBusy(false)
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setImageError(null)
    const data = new FormData(event.currentTarget)
    try {
      const updated = await updateItem(token, item.id, {
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as Item['identifier_type'],
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
        manufacturer: String(data.get('manufacturer')).trim() || undefined,
        model: String(data.get('model')).trim() || undefined,
        serial_number: String(data.get('serialNumber')).trim() || undefined,
        description: String(data.get('description')).trim() || undefined,
        notes: String(data.get('notes')).trim() || undefined,
      })
      const target = String(data.get('placement'))
      if (target) {
        const [targetType, targetId] = target.split(':')
        const updatedPlacement = await placeItem(token, item.id, {
          [`${targetType}_id`]: targetId,
          ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}),
        })
        onPlacementUpdated?.(updatedPlacement)
        setDisplayLocation(itemLocation(updatedPlacement, areas, zones, containers, containerPlacements))
      }
      onUpdated(updated)
      setEditing(false)
    } catch (reason) {
      setImageError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="item-details-title" aria-modal="true" className="location-dialog item-details-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="eyebrow">Item details</p><h2 id="item-details-title">{item.name}</h2></div>
          <button aria-label="Close item details" onClick={onClose}>×</button>
        </div>
        <div className="item-image-panel">
          {imageUrl ? <img alt={item.name} src={imageUrl} /> : <div className="item-image-placeholder"><ImageIcon aria-hidden="true" /><strong>No image yet</strong><span>Add a photo to make this item easier to identify.</span></div>}
          <label className="item-image-action"><Camera aria-hidden="true" /><span>{imageBusy ? 'Uploading…' : imageUrl ? 'Replace image' : 'Add image'}</span><input accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={(event) => { void changeImage(event.target.files?.[0]); event.target.value = '' }} type="file" /></label>
        </div>
        {imageError ? <div className="alert">{imageError}</div> : null}
        {editing ? <form className="item-edit-form" onSubmit={saveItem}>
          <label>Name<input autoFocus defaultValue={item.name} name="name" required /></label>
          <div className="form-row"><label>Quantity<input defaultValue={Number(item.quantity)} min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><input defaultValue={item.unit ?? ''} name="unit" /></label></div>
          <div className="form-row"><label>Manufacturer <span className="optional">Optional</span><input defaultValue={item.manufacturer ?? ''} name="manufacturer" /></label><label>Model <span className="optional">Optional</span><input defaultValue={item.model ?? ''} name="model" /></label></div>
          <div className="form-row"><label>Serial number <span className="optional">Optional</span><input defaultValue={item.serial_number ?? ''} name="serialNumber" /></label><label>Code<input className="readonly-input" readOnly value={item.code} /></label></div>
          <PhysicalIdentifierPicker defaultValue={item.identifier_type} />
          <label>Location<select defaultValue={placement?.area_id ? `area:${placement.area_id}` : placement?.zone_id ? `zone:${placement.zone_id}` : placement?.container_id ? `container:${placement.container_id}` : ''} name="placement"><option disabled value="">Choose a location</option>{areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}{zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{areas.find((area) => area.id === zone.area_id)?.name} / {zone.name}</option>)}{containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{itemLocation({ id: '', item_id: item.id, area_id: null, zone_id: null, container_id: container.id, relationship_type: 'in', created_at: '', updated_at: '' }, areas, zones, containers, containerPlacements)}</option>)}</select></label>
          <label>Description <span className="optional">Optional</span><textarea defaultValue={item.description ?? ''} name="description" rows={3} /></label>
          <label>Notes <span className="optional">Optional</span><textarea defaultValue={item.notes ?? ''} name="notes" rows={3} /></label>
          <div className="dialog-actions"><button className="secondary-action" onClick={() => setEditing(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form> : <>
        <div className="item-detail-location"><MapPin aria-hidden="true" /><span><small>Location</small><strong>{displayLocation}</strong></span></div>
        <dl className="item-detail-grid">
          <div><dt>Quantity</dt><dd>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</dd></div>
          <div><dt>Code</dt><dd>{item.code}</dd></div>
          <div><dt>Physical identifier</dt><dd className="physical-identifier-value">{item.identifier_type !== 'nfc' && item.identifier_type !== 'none' ? <QrCode aria-hidden="true" /> : null}{item.identifier_type !== 'qr' && item.identifier_type !== 'none' ? <Radio aria-hidden="true" /> : null}{item.identifier_type === 'none' ? 'Neither' : item.identifier_type === 'both' ? 'QR + NFC' : item.identifier_type.toUpperCase()}</dd></div>
          <div><dt>Manufacturer</dt><dd>{item.manufacturer || '—'}</dd></div>
          <div><dt>Model</dt><dd>{item.model || '—'}</dd></div>
          <div><dt>Serial number</dt><dd>{item.serial_number || '—'}</dd></div>
          <div><dt>Added</dt><dd>{formatDate(item.created_at)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
        </dl>
        {item.description ? <div className="item-detail-copy"><strong>Description</strong><p>{item.description}</p></div> : null}
        {item.notes ? <div className="item-detail-copy"><strong>Notes</strong><p>{item.notes}</p></div> : null}
        <div className="dialog-actions"><button className="secondary-action" onClick={onClose}>Close</button><button className="secondary-action" onClick={() => setShowLabel(true)}><Printer aria-hidden="true" /> Print QR</button><button className="primary-button" onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Edit item</button></div></>}
      </section>
      {showLabel ? <ItemLabelModal item={item} onClose={() => setShowLabel(false)} token={token} /> : null}
    </div>
  )
}

export function ItemsView({ household, onRevealConsumed, refreshKey = 0, revealItemId, revealScanKey, token }: { household: Household; onRevealConsumed?: () => void; refreshKey?: number; revealItemId?: string; revealScanKey?: string; token: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [placements, setPlacements] = useState<ItemPlacement[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [containerPlacements, setContainerPlacements] = useState<ContainerPlacement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadInventory() {
    const [nextItems, nextPlacements, nextAreas] = await Promise.all([
      listItems(token, household.id),
      listItemPlacements(token, household.id),
      listAreas(token, household.id),
    ])
    const details = await Promise.all(nextAreas.map(async (area) => {
      const [areaZones, areaContainers, areaPlacements] = await Promise.all([
        listZones(token, area.id),
        listContainers(token, area.id),
        listContainerPlacements(token, area.id),
      ])
      return { areaZones, areaContainers, areaPlacements }
    }))
    setItems(nextItems)
    setSelectedItem((current) => current ? nextItems.find((item) => item.id === current.id) ?? null : null)
    setPlacements(nextPlacements)
    setAreas(nextAreas)
    setZones(details.flatMap((detail) => detail.areaZones))
    setContainers(details.flatMap((detail) => detail.areaContainers))
    setContainerPlacements(details.flatMap((detail) => detail.areaPlacements))
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadInventory().catch((reason) => setError(message(reason))).finally(() => setLoading(false))
  }, [household.id, refreshKey, token])

  useEffect(() => {
    if (!revealItemId) return
    const item = items.find((entry) => entry.id === revealItemId)
    if (item) {
      setSelectedItem(item)
      onRevealConsumed?.()
    }
  }, [items, onRevealConsumed, revealItemId, revealScanKey])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const item = await createItem(token, household.id, {
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as Item['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
        manufacturer: String(data.get('manufacturer')).trim() || undefined,
        model: String(data.get('model')).trim() || undefined,
      })
      const target = String(data.get('placement'))
      if (target) {
        const [targetType, targetId] = target.split(':')
        await placeItem(token, item.id, {
          [`${targetType}_id`]: targetId,
          ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}),
        })
      }
      await loadInventory()
      setShowForm(false)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="items-view">
      <div className="page-heading locations-heading"><div><p className="eyebrow">Household inventory</p><h1>Items</h1><p className="page-description">Everything you track, with its exact storage path.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Add item</button></div>
      {error ? <div className="alert locations-alert">{error}</div> : null}
      <section className="items-panel">
        {loading ? <div className="locations-loading">Loading items…</div> : items.length ? (
          <table className="items-table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Details</th></tr></thead>
            <tbody>{items.map((item) => {
              const placement = placements.find((entry) => entry.item_id === item.id)
              return <tr key={item.id}><td><button className="item-details-button" onClick={() => setSelectedItem(item)}><strong>{item.name}</strong>{item.description ? <small>{item.description}</small> : null}</button></td><td>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</td><td><span className={placement ? 'location-path' : 'unplaced-badge'}>{itemLocation(placement, areas, zones, containers, containerPlacements)}</span></td><td>{[item.manufacturer, item.model].filter(Boolean).join(' · ') || '—'}</td></tr>
            })}</tbody>
          </table>
        ) : <div className="location-empty"><div className="empty-illustration"><PackagePlus aria-hidden="true" /></div><strong>No items yet</strong><p>Add your first item and place it directly in an area, zone, or container.</p><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Add first item</button></div>}
      </section>
      {selectedItem ? <ItemDetailsModal areas={areas} containerPlacements={containerPlacements} containers={containers} item={selectedItem} locationLabel={itemLocation(placements.find((entry) => entry.item_id === selectedItem.id), areas, zones, containers, containerPlacements)} onClose={() => setSelectedItem(null)} onPlacementUpdated={(updated) => setPlacements((current) => [...current.filter((entry) => entry.item_id !== updated.item_id), updated])} onUpdated={(updated) => { setSelectedItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} placement={placements.find((entry) => entry.item_id === selectedItem.id)} token={token} zones={zones} /> : null}
      {showForm ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section aria-labelledby="item-dialog-title" aria-modal="true" className="location-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Inventory</p><h2 id="item-dialog-title">Add an item</h2></div><button aria-label="Close" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={submit}>
        <label>Name<input autoFocus name="name" placeholder="Cordless drill" required /></label>
        <div className="form-row"><label>Quantity<input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><input name="unit" placeholder="pieces, boxes, feet" /></label></div>
        <div className="form-row"><label>Manufacturer <span className="optional">Optional</span><input name="manufacturer" /></label><label>Model <span className="optional">Optional</span><input name="model" /></label></div>
        <PhysicalIdentifierPicker />
        <label>Location <span className="optional">Optional</span><select defaultValue="" name="placement"><option value="">Unplaced</option>{areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}{zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{areas.find((area) => area.id === zone.area_id)?.name} / {zone.name}</option>)}{containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{itemLocation({ id: '', item_id: '', area_id: null, zone_id: null, container_id: container.id, relationship_type: 'in', created_at: '', updated_at: '' }, areas, zones, containers, containerPlacements)}</option>)}</select></label>
        <label>Description <span className="optional">Optional</span><textarea name="description" rows={3} /></label>
        <div className="dialog-actions"><button className="secondary-action" onClick={() => setShowForm(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</button></div>
      </form></section></div> : null}
    </div>
  )
}
