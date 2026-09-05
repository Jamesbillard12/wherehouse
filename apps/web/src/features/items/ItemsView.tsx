import {
  createItem,
  deleteItem,
  getItemImage,
  listAreas,
  listContainerPlacements,
  listContainers,
  listItemPlacements,
  listItems,
  listZones,
  uploadItemImage,
  updateItem,
  type Area,
  type ContainerPlacement,
  type Workspace,
  type Item,
  type ItemPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import { Box, Camera, Image as ImageIcon, MapPin, PackagePlus, Pencil, Plus, Printer, QrCode, Radio, Trash2, X } from 'lucide-react'
import { type FormEvent, type MouseEvent, type RefObject, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '../../components/wherehouse/ConfirmDialog'
import { CreateImageField } from '../../components/wherehouse/CreateImageField'
import { PageHeader } from '../../components/wherehouse/PageHeader'
import { ImageCropDialog } from '../../components/wherehouse/ImageCropDialog'
import { EmptyState, LoadingState, StatusMessage } from '../../components/wherehouse/StateDisplay'
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
  if (placement.resolved_path) return placement.resolved_path
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

export function ItemDetailsModal({ areas, containerPlacements, containers, imageRevision = 0, initialMode = 'details', item, locationLabel, onClose, onDeleted, onPlacementUpdated, onUpdated, placement, token, zones }: { areas: Area[]; containerPlacements: ContainerPlacement[]; containers: StorageContainer[]; imageRevision?: number; initialMode?: 'details' | 'edit' | 'delete'; item: Item; locationLabel: string; onClose: () => void; onDeleted: (itemId: string) => void; onPlacementUpdated?: (placement: ItemPlacement) => void; onUpdated: (item: Item) => void; placement?: ItemPlacement; token: string; zones: Zone[] }) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [localImageRevision, setLocalImageRevision] = useState(0)
  const [imageToCrop, setImageToCrop] = useState<File | null>(null)
  const [editing, setEditing] = useState(initialMode === 'edit')
  const [saving, setSaving] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(initialMode === 'delete')
  const [deleting, setDeleting] = useState(false)
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
  }, [imageRevision, item.id, item.image_path, localImageRevision, token])

  async function changeImage(file: File | undefined) {
    if (!file) return
    setImageBusy(true)
    setImageError(null)
    try {
      const updated = await uploadItemImage(token, item.id, file)
      onUpdated(updated)
      setLocalImageRevision((current) => current + 1)
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
      const target = String(data.get('placement'))
      const [targetType, targetId] = target.split(':')
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
        ...(target ? { placement: { [`${targetType}_id`]: targetId, ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}) } } : {}),
      })
      if (target) {
        const updatedPlacement: ItemPlacement = {
          id: placement?.id ?? `pending-${item.id}`,
          item_id: item.id,
          area_id: targetType === 'area' ? targetId : null,
          zone_id: targetType === 'zone' ? targetId : null,
          container_id: targetType === 'container' ? targetId : null,
          relationship_type: targetType === 'container' ? 'in' : null,
          created_at: placement?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
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

  async function removeItem() {
    setDeleting(true)
    setImageError(null)
    try {
      await deleteItem(token, item.id)
      onDeleted(item.id)
    } catch (reason) {
      setImageError(message(reason))
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving && !deleting && !imageBusy) onClose() }}>
      <DialogContent className="location-dialog item-details-dialog block max-w-[calc(100%-3rem)] overflow-y-auto p-0 sm:max-w-[620px]" showCloseButton={false}>
        <DialogHeader className="dialog-heading flex-row">
          <div><p className="eyebrow">Item details</p><DialogTitle>{item.name}</DialogTitle><DialogDescription className="sr-only">View and edit item details.</DialogDescription></div>
          <DialogClose aria-label="Close item details" disabled={saving || deleting || imageBusy} render={<Button size="icon" variant="secondary" />}><X aria-hidden="true" /></DialogClose>
        </DialogHeader>
        <div className="item-image-panel">
          {imageUrl ? <img alt={item.name} className="absolute inset-0 size-full object-cover" src={imageUrl} /> : <div className="item-image-placeholder"><ImageIcon aria-hidden="true" /><strong>No image yet</strong><span>Add a photo to make this item easier to identify.</span></div>}
          <label className="item-image-action"><Camera aria-hidden="true" /><span>{imageBusy ? 'Uploading…' : imageUrl ? 'Replace image' : 'Add image'}</span><input accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={(event) => { setImageToCrop(event.target.files?.[0] ?? null); event.target.value = '' }} type="file" /></label>
        </div>
        {imageError && !confirmingDelete ? <div className="alert">{imageError}</div> : null}
        {editing ? <form className="item-edit-form" onSubmit={saveItem}>
          <label>Name<Input autoFocus defaultValue={item.name} name="name" required /></label>
          <div className="form-row"><label>Quantity<Input defaultValue={Number(item.quantity)} min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><Input defaultValue={item.unit ?? ''} name="unit" /></label></div>
          <div className="form-row"><label>Manufacturer <span className="optional">Optional</span><Input defaultValue={item.manufacturer ?? ''} name="manufacturer" /></label><label>Model <span className="optional">Optional</span><Input defaultValue={item.model ?? ''} name="model" /></label></div>
          <div className="form-row"><label>Serial number <span className="optional">Optional</span><Input defaultValue={item.serial_number ?? ''} name="serialNumber" /></label><label>Code<Input className="readonly-input" readOnly value={item.code} /></label></div>
          <PhysicalIdentifierPicker defaultValue={item.identifier_type} />
          <label>Location<select defaultValue={placement?.area_id ? `area:${placement.area_id}` : placement?.zone_id ? `zone:${placement.zone_id}` : placement?.container_id ? `container:${placement.container_id}` : ''} name="placement"><option disabled value="">Choose a location</option>{areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}{zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{areas.find((area) => area.id === zone.area_id)?.name} / {zone.name}</option>)}{containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{itemLocation({ id: '', item_id: item.id, area_id: null, zone_id: null, container_id: container.id, relationship_type: 'in', created_at: '', updated_at: '' }, areas, zones, containers, containerPlacements)}</option>)}</select></label>
          <label>Description <span className="optional">Optional</span><Textarea defaultValue={item.description ?? ''} name="description" rows={3} /></label>
          <label>Notes <span className="optional">Optional</span><Textarea defaultValue={item.notes ?? ''} name="notes" rows={3} /></label>
          <div className="dialog-actions"><Button className="secondary-action" onClick={() => setEditing(false)} type="button">Cancel</Button><Button className="primary-button" pending={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button></div>
        </form> : <>
        <div className="item-detail-location"><MapPin aria-hidden="true" /><span><small>Location</small><strong>{displayLocation}</strong></span></div>
        <dl className="item-detail-grid">
          <div><dt>Quantity</dt><dd>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</dd></div>
          <div><dt>Code</dt><dd>{item.code}</dd></div>
          <div className="physical-identifier-detail"><dt>Physical identifier</dt><dd><span className="physical-identifier-value">{item.identifier_type !== 'nfc' && item.identifier_type !== 'none' ? <QrCode aria-hidden="true" /> : null}{item.identifier_type !== 'qr' && item.identifier_type !== 'none' ? <Radio aria-hidden="true" /> : null}{item.identifier_type === 'none' ? 'Neither' : item.identifier_type === 'both' ? 'QR + NFC' : item.identifier_type.toUpperCase()}</span>{item.identifier_type === 'qr' || item.identifier_type === 'both' ? <Button className="identifier-print-button" onClick={() => setShowLabel(true)} size="sm" variant="outline"><Printer aria-hidden="true" /> Print QR</Button> : null}</dd></div>
          <div><dt>Manufacturer</dt><dd>{item.manufacturer || '—'}</dd></div>
          <div><dt>Model</dt><dd>{item.model || '—'}</dd></div>
          <div><dt>Serial number</dt><dd>{item.serial_number || '—'}</dd></div>
          <div><dt>Added</dt><dd>{formatDate(item.created_at)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
        </dl>
        {item.description ? <div className="item-detail-copy"><strong>Description</strong><p>{item.description}</p></div> : null}
        {item.notes ? <div className="item-detail-copy"><strong>Notes</strong><p>{item.notes}</p></div> : null}
        <div className="dialog-actions item-details-actions"><Button aria-label={`Archive ${item.name}`} onClick={() => setConfirmingDelete(true)} size="icon" title={`Archive ${item.name}`} variant="destructive"><Trash2 aria-hidden="true" /></Button><span className="dialog-action-spacer" /><DialogClose render={<Button variant="outline" />}>Close</DialogClose><Button onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Edit item</Button></div></>}
      <ConfirmDialog busy={deleting} confirmLabel="Archive item" description="This removes the item from active inventory while retaining its archived record." destructive error={imageError} onCancel={() => { setConfirmingDelete(false); setImageError(null) }} onConfirm={removeItem} open={confirmingDelete} title={`Archive ${item.name}?`} />
      <ImageCropDialog file={imageToCrop} onCancel={() => setImageToCrop(null)} onConfirm={(file) => { setImageToCrop(null); void changeImage(file) }} />
      {showLabel ? <ItemLabelModal item={item} onClose={() => setShowLabel(false)} token={token} /> : null}
      </DialogContent>
    </Dialog>
  )
}

export function AddItemDialog({ areas, containerPlacements, containers, eyebrow = 'Inventory', finalFocus, onOpenChange, onSubmit, open, saving, zones }: { areas: Area[]; containerPlacements: ContainerPlacement[]; containers: StorageContainer[]; eyebrow?: string; finalFocus?: RefObject<HTMLElement | null>; onOpenChange: (open: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>, image: File | null) => void; open: boolean; saving: boolean; zones: Zone[] }) {
  const [image, setImage] = useState<File | null>(null)

  useEffect(() => {
    if (!open) setImage(null)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="location-dialog max-w-[calc(100%-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]" finalFocus={finalFocus} showCloseButton={false}>
        <DialogHeader className="dialog-heading flex-row">
          <div><p className="eyebrow">{eyebrow}</p><DialogTitle id="item-dialog-title">Add an item</DialogTitle></div>
          <DialogClose aria-label="Close add item dialog" render={<Button size="icon" type="button" variant="secondary" />}>×</DialogClose>
        </DialogHeader>
        <form onSubmit={(event) => onSubmit(event, image)}>
          <CreateImageField label="Item image" onFileChange={setImage} />
          <label>Name<Input autoFocus name="name" placeholder="Cordless drill" required /></label>
          <div className="form-row"><label>Quantity<Input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><Input name="unit" placeholder="pieces, boxes, feet" /></label></div>
          <div className="form-row"><label>Manufacturer <span className="optional">Optional</span><Input name="manufacturer" /></label><label>Model <span className="optional">Optional</span><Input name="model" /></label></div>
          <PhysicalIdentifierPicker />
          <label>Location <span className="optional">Optional</span><select defaultValue="" name="placement"><option value="">Unplaced</option>{areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}{zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{areas.find((area) => area.id === zone.area_id)?.name} / {zone.name}</option>)}{containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{itemLocation({ id: '', item_id: '', area_id: null, zone_id: null, container_id: container.id, relationship_type: 'in', created_at: '', updated_at: '' }, areas, zones, containers, containerPlacements)}</option>)}</select></label>
          <label>Description <span className="optional">Optional</span><Textarea name="description" rows={3} /></label>
          <div className="dialog-actions"><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button pending={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ItemsView({ createRequestKey = 0, workspace, onCreateOpenChange, onCreated, onOpenLocation, onRevealConsumed, refreshKey = 0, revealItem, revealItemId, revealScanKey, token }: { createRequestKey?: number; workspace: Workspace; onCreateOpenChange?: (open: boolean) => void; onCreated?: (item: Item) => void; onOpenLocation: (target: { areaId: string; containerId?: string; zoneId?: string }) => void; onRevealConsumed?: () => void; refreshKey?: number; revealItem?: Item; revealItemId?: string; revealScanKey?: string; token: string }) {
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
  const addItemTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (createRequestKey > 0) setShowForm(true)
  }, [createRequestKey])

  function openAddItemDialog(event: MouseEvent<HTMLButtonElement>) {
    addItemTriggerRef.current = event.currentTarget
    setShowForm(true)
  }

  async function loadInventory() {
    const [nextItems, nextPlacements, nextAreas] = await Promise.all([
      listItems(token, workspace.id),
      listItemPlacements(token, workspace.id),
      listAreas(token, workspace.id),
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
  }, [workspace.id, refreshKey, token])

  useEffect(() => {
    if (!revealItemId) return
    const item = revealItem ?? items.find((entry) => entry.id === revealItemId)
    if (item) {
      setSelectedItem(item)
      onRevealConsumed?.()
    }
  }, [items, onRevealConsumed, revealItem, revealItemId, revealScanKey])

  async function submit(event: FormEvent<HTMLFormElement>, image: File | null) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      let item = await createItem(token, workspace.id, {
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as Item['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
        manufacturer: String(data.get('manufacturer')).trim() || undefined,
        model: String(data.get('model')).trim() || undefined,
        ...(String(data.get('placement')) ? (() => {
          const [targetType, targetId] = String(data.get('placement')).split(':')
          return { placement: { [`${targetType}_id`]: targetId, ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}) } }
        })() : {}),
      })
      if (image?.size) item = await uploadItemImage(token, item.id, image)
      await loadInventory()
      setShowForm(false)
      onCreateOpenChange?.(false)
      onCreated?.(item)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="items-view">
      <PageHeader actions={<Button className="primary-button" onClick={openAddItemDialog}><Plus aria-hidden="true" /> Add item</Button>} description="Everything you track, with its exact storage path." eyebrow="Household inventory" title="Items" />
      {error ? <StatusMessage className="locations-alert" tone="error">{error}</StatusMessage> : null}
      <section className="items-panel">
        {loading ? <LoadingState label="Loading items…" /> : items.length ? (
          <table className="items-table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Details</th></tr></thead>
            <tbody>{[...items].sort((left, right) => {
              const leftPlacement = placements.find((entry) => entry.item_id === left.id)
              const rightPlacement = placements.find((entry) => entry.item_id === right.id)
              const locationOrder = itemLocation(leftPlacement, areas, zones, containers, containerPlacements).localeCompare(itemLocation(rightPlacement, areas, zones, containers, containerPlacements), undefined, { numeric: true, sensitivity: 'base' })
              return locationOrder || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
            }).map((item) => {
              const placement = placements.find((entry) => entry.item_id === item.id)
              const locationLabel = itemLocation(placement, areas, zones, containers, containerPlacements)
              const areaId = placement?.area_id ?? zones.find((zone) => zone.id === placement?.zone_id)?.area_id ?? containers.find((container) => container.id === placement?.container_id)?.area_id
              return <tr key={item.id}><td><a className="item-details-button" href={`/items#${item.id}`} onClick={(event) => { event.preventDefault(); setSelectedItem(item) }}><strong>{item.name}</strong>{item.description ? <small>{item.description}</small> : null}</a></td><td>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</td><td>{placement && areaId ? <a className="location-path" href="/locations" onClick={(event) => { event.preventDefault(); onOpenLocation({ areaId, ...(placement.container_id ? { containerId: placement.container_id } : {}), ...(placement.zone_id ? { zoneId: placement.zone_id } : {}) }) }}>{locationLabel}</a> : <span className="unplaced-badge">{locationLabel}</span>}</td><td>{[item.manufacturer, item.model].filter(Boolean).join(' · ') || '—'}</td></tr>
            })}</tbody>
          </table>
        ) : <EmptyState action={<Button className="primary-button compact" onClick={openAddItemDialog}><Plus aria-hidden="true" /> Add first item</Button>} description="Add your first item and place it directly in an area, zone, or container." icon={PackagePlus} title="No items yet" />}
      </section>
      {selectedItem ? <ItemDetailsModal areas={areas} containerPlacements={containerPlacements} containers={containers} imageRevision={refreshKey} item={selectedItem} locationLabel={itemLocation(placements.find((entry) => entry.item_id === selectedItem.id), areas, zones, containers, containerPlacements)} onClose={() => setSelectedItem(null)} onDeleted={(itemId) => { setSelectedItem(null); setItems((current) => current.filter((item) => item.id !== itemId)); setPlacements((current) => current.filter((entry) => entry.item_id !== itemId)) }} onPlacementUpdated={(updated) => setPlacements((current) => [...current.filter((entry) => entry.item_id !== updated.item_id), updated])} onUpdated={(updated) => { setSelectedItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} placement={placements.find((entry) => entry.item_id === selectedItem.id)} token={token} zones={zones} /> : null}
      <AddItemDialog areas={areas} containerPlacements={containerPlacements} containers={containers} finalFocus={addItemTriggerRef} onOpenChange={(open) => { setShowForm(open); onCreateOpenChange?.(open) }} onSubmit={submit} open={showForm} saving={saving} zones={zones} />
    </div>
  )
}
