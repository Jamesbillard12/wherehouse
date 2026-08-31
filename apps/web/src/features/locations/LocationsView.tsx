import {
  createArea,
  createContainer,
  createItem,
  createZone,
  deleteArea,
  deleteContainer,
  listAreas,
  listContainerPlacements,
  listContainers,
  listItemPlacements,
  listItems,
  listZones,
  placeContainer,
  placeItem,
  removeContainerPlacement,
  setContainerSpace,
  updateAreaIcon,
  updateContainer,
  updateZone,
  type Area,
  type ContainerPlacement,
  type ContainerType,
  type Household,
  type Item,
  type ItemPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import {
  Box,
  Building2,
  Caravan,
  ChevronRight,
  CircleOff,
  Container,
  Hammer,
  House,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Radio,
  Trash2,
  TreePine,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { ItemDetailsModal, itemLocation } from '../items/ItemsView'
import { PhysicalIdentifierPicker } from '../items/PhysicalIdentifierPicker'
import { message } from '../../shared/utils/errors'
import { areaKey } from '../../shared/utils/storage'
import { AreaIcon, AreaIconPicker, CONTAINER_TYPES } from './locationOptions'

export { AreaIcon } from './locationOptions'
export function LocationsView({ household, token }: { household: Household; token: string }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [placements, setPlacements] = useState<ContainerPlacement[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [itemPlacements, setItemPlacements] = useState<ItemPlacement[]>([])
  const [openContainerId, setOpenContainerId] = useState<string | null>(null)
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [formMode, setFormMode] = useState<'area' | 'zone' | 'edit-zone' | 'container' | 'edit-container' | 'icon' | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null)
  const [showNestedItemForm, setShowNestedItemForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAreas(preferredId?: string) {
    const nextAreas = await listAreas(token, household.id)
    setAreas(nextAreas)
    setSelectedAreaId((current) => {
      const candidate = preferredId || current || localStorage.getItem(areaKey(household.id)) || ''
      return nextAreas.some((area) => area.id === candidate) ? candidate : (nextAreas[0]?.id ?? '')
    })
  }

  async function loadAreaDetails(areaId: string) {
    if (!areaId) {
      setZones([])
      setContainers([])
      setPlacements([])
      return
    }
    const [nextZones, nextContainers, nextPlacements, nextItems, nextItemPlacements] = await Promise.all([
      listZones(token, areaId),
      listContainers(token, areaId),
      listContainerPlacements(token, areaId),
      listItems(token, household.id),
      listItemPlacements(token, household.id),
    ])
    setZones(nextZones)
    setContainers(nextContainers)
    setPlacements(nextPlacements)
    setItems(nextItems)
    setItemPlacements(nextItemPlacements)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadAreas()
      .catch((reason) => setError(message(reason)))
      .finally(() => setLoading(false))
  }, [household.id, token])

  useEffect(() => {
    setError(null)
    setOpenContainerId(null)
    setSelectedZoneFilter('')
    if (selectedAreaId) localStorage.setItem(areaKey(household.id), selectedAreaId)
    void loadAreaDetails(selectedAreaId).catch((reason) => setError(message(reason)))
  }, [household.id, selectedAreaId, token])

  async function submitArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const area = await createArea(token, household.id, {
        name: String(data.get('name')).trim(),
        icon: String(data.get('icon')),
        description: String(data.get('description')).trim() || undefined,
      })
      await loadAreas(area.id)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitAreaIcon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArea) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const updated = await updateAreaIcon(token, selectedArea.id, String(data.get('icon')))
      setAreas((current) => current.map((area) => area.id === updated.id ? updated : area))
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function removeArea() {
    if (!selectedArea) return
    const detail = containers.length || zones.length
      ? ` This also removes its ${zones.length} zones and ${containers.length} containers.`
      : ''
    if (!confirm(`Delete ${selectedArea.name}?${detail} This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteArea(token, selectedArea.id)
      await loadAreas()
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await createZone(token, selectedAreaId, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
      })
      await loadAreaDetails(selectedAreaId)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitZoneEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedZone) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const updated = await updateZone(token, selectedZone.id, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
      })
      setZones((current) => current.map((zone) => zone.id === updated.id ? updated : zone))
      setSelectedZone(null)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  function editZone(zone: Zone) {
    setSelectedZone(zone)
    setFormMode('edit-zone')
  }

  async function submitContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const container = await createContainer(token, {
        area_id: selectedAreaId,
        zone_id: String(data.get('zoneId')) || undefined,
        name: String(data.get('name')).trim(),
        container_type: String(data.get('containerType')) as ContainerType,
        identifier_type: String(data.get('identifierType')) as StorageContainer['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        is_movable: data.get('isMovable') === 'on',
      })
      const parentId = String(data.get('parentId'))
      if (parentId) {
        await placeContainer(token, container.id, {
          parent_container_id: parentId,
          relationship_type: String(data.get('relationshipType')) as ContainerPlacement['relationship_type'],
        })
      }
      await loadAreaDetails(selectedAreaId)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitContainerEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedContainer) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await updateContainer(token, selectedContainer.id, {
        zone_id: String(data.get('zoneId')) || undefined,
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as StorageContainer['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        is_movable: data.get('isMovable') === 'on',
      })
      const parentId = String(data.get('parentId'))
      if (parentId) {
        await placeContainer(token, selectedContainer.id, {
          parent_container_id: parentId,
          relationship_type: String(data.get('relationshipType')) as ContainerPlacement['relationship_type'],
        })
      } else if (placements.some((placement) => placement.container_id === selectedContainer.id)) {
        await removeContainerPlacement(token, selectedContainer.id)
      }
      await loadAreaDetails(selectedAreaId)
      setSelectedContainer(null)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  function editContainer(container: StorageContainer) {
    setSelectedContainer(container)
    setFormMode('edit-container')
  }

  async function removeContainer(container: StorageContainer) {
    const childCount = placements.filter(
      (placement) => placement.parent_container_id === container.id,
    ).length
    const childWarning = childCount
      ? ` ${childCount} nested container${childCount === 1 ? '' : 's'} will remain in the area without this parent.`
      : ''
    if (!confirm(`Delete ${container.name} (${container.code})?${childWarning} Item placements in this container will be cleared. This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteContainer(token, container.id)
      await loadAreaDetails(selectedAreaId)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function toggleSpace(container: StorageContainer) {
    setError(null)
    try {
      const updated = await setContainerSpace(token, container.id, !container.is_out_of_space)
      setContainers((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
    } catch (reason) {
      setError(message(reason))
    }
  }

  async function submitNestedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!openContainerId) return
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
      })
      await placeItem(token, item.id, {
        container_id: openContainerId,
        relationship_type: 'in',
      })
      await loadAreaDetails(selectedAreaId)
      setShowNestedItemForm(false)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  const selectedArea = areas.find((area) => area.id === selectedAreaId)
  const placementByContainer = new Map(placements.map((placement) => [placement.container_id, placement]))
  const containerById = new Map(containers.map((container) => [container.id, container]))
  const openContainer = openContainerId ? containerById.get(openContainerId) : null
  const openContainerTrail: StorageContainer[] = []
  let trailCursor = openContainer
  while (trailCursor) {
    openContainerTrail.unshift(trailCursor)
    const parentId = placementByContainer.get(trailCursor.id)?.parent_container_id
    trailCursor = parentId ? containerById.get(parentId) : undefined
  }
  const visibleContainers = containers.filter((container) => {
    const parentId = placementByContainer.get(container.id)?.parent_container_id
    return openContainerId
      ? parentId === openContainerId
      : !parentId && (!selectedZoneFilter || container.zone_id === selectedZoneFilter)
  })
  const visibleItems = items.filter((item) => {
    const placement = itemPlacements.find((entry) => entry.item_id === item.id)
    if (!placement) return false
    if (openContainerId) return placement.container_id === openContainerId
    if (selectedZoneFilter) return placement.zone_id === selectedZoneFilter
    return placement.area_id === selectedAreaId || zones.some((zone) => zone.id === placement.zone_id)
  })

  return (
    <div className="locations-view">
      <div className="page-heading locations-heading">
        <div>
          <p className="eyebrow">Storage map</p>
          <h1>Locations</h1>
          <p className="page-description">Organize areas, zones, and every container inside them.</p>
        </div>
      </div>

      {error ? <div className="alert locations-alert">{error}</div> : null}

      {loading ? <div className="locations-loading">Loading locations…</div> : areas.length ? (
        <div className="locations-layout">
          <aside className="area-list" aria-label="Areas">
            <div className="section-title">
              <span>Areas <strong>{areas.length}</strong></span>
              <button aria-label="Add area" onClick={() => setFormMode('area')} title="Add area"><Plus aria-hidden="true" /></button>
            </div>
            {areas.map((area) => {
              const count = area.id === selectedAreaId ? containers.length : null
              return (
                <button className={area.id === selectedAreaId ? 'selected' : ''} key={area.id} onClick={() => setSelectedAreaId(area.id)}>
                  <span className="area-icon"><AreaIcon name={area.icon} /></span>
                  <span><strong>{area.name}</strong><small>{count === null ? 'Open area' : `${zones.length} zones · ${count} containers`}</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              )
            })}
          </aside>

          <section className="area-detail">
            <div className="area-detail-heading">
              <div className="selected-area-title"><span className="area-icon large"><AreaIcon name={selectedArea?.icon ?? 'warehouse'} /></span><div><p className="eyebrow">Selected area</p><h2>{selectedArea?.name}</h2>{selectedArea?.description ? <p>{selectedArea.description}</p> : null}</div></div>
              <div className="area-actions">
                <button aria-label="Change area icon" className="icon-action" onClick={() => setFormMode('icon')} title="Change icon"><AreaIcon name={selectedArea?.icon ?? 'warehouse'} /></button>
                <button className="secondary-action" onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button>
                <button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</button>
                <button aria-label={`Delete ${selectedArea?.name}`} className="icon-action danger" disabled={saving} onClick={() => void removeArea()} title="Delete area"><Trash2 aria-hidden="true" /></button>
              </div>
            </div>

            {zones.length ? (
              <div className="zone-chips">
                <span>Zones</span>
                <button className={`zone-filter ${selectedZoneFilter === '' ? 'selected' : ''}`} onClick={() => { setSelectedZoneFilter(''); setOpenContainerId(null) }}>All</button>
                {zones.map((zone) => <span className={`zone-chip ${selectedZoneFilter === zone.id ? 'selected' : ''}`} key={zone.id}><button className="zone-filter-name" onClick={() => { setSelectedZoneFilter(zone.id); setOpenContainerId(null) }}>{zone.name}</button><button aria-label={`Edit ${zone.name}`} onClick={() => editZone(zone)} title={`Edit ${zone.name}`}><Pencil aria-hidden="true" /></button></span>)}
                <button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button>
              </div>
            ) : <div className="empty-strip"><span><MapPin aria-hidden="true" /> No zones yet. Add one to describe a shelf wall, workbench, or other section.</span><button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button></div>}

            {openContainer ? <div className="container-breadcrumb"><button className="back-button" onClick={() => setOpenContainerId(placementByContainer.get(openContainer.id)?.parent_container_id ?? null)}>← Back</button><nav aria-label="Container location" className="container-path">{openContainerTrail.map((container, index) => <span className="path-segment" key={container.id}>{index ? <ChevronRight aria-hidden="true" /> : null}{index < openContainerTrail.length - 1 ? <button onClick={() => setOpenContainerId(container.id)}>{container.name}</button> : <strong>{container.name}</strong>}</span>)}</nav><small>{openContainer.code}</small><div className="nested-actions"><button className="add-nested-button" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</button><button className="add-nested-button" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</button></div></div> : null}

            {visibleContainers.length || visibleItems.length ? (
              <div className="container-list">
                {visibleContainers.map((container) => {
                  const placement = placementByContainer.get(container.id)
                  const parent = placement ? containerById.get(placement.parent_container_id) : null
                  const zone = zones.find((entry) => entry.id === container.zone_id)
                  return (
                    <article key={container.id}>
                      <div className="container-icon"><Container aria-hidden="true" /></div>
                      <button className="container-copy container-open" onClick={() => setOpenContainerId(container.id)}>
                        <div><strong>{container.name}</strong><span className="type-badge">{container.container_type.replace('_', ' ')}</span>{container.identifier_type !== 'none' ? <span className="identifier-badge">{container.identifier_type !== 'nfc' ? <QrCode aria-hidden="true" /> : null}{container.identifier_type !== 'qr' ? <Radio aria-hidden="true" /> : null}{container.identifier_type === 'both' ? 'QR + NFC' : container.identifier_type.toUpperCase()}</span> : null}{container.is_out_of_space ? <span className="full-badge">Full</span> : null}</div>
                        <span>{[zone?.name, parent ? `${placement?.relationship_type.replace('_', ' ')} ${parent.name}` : null, container.code].filter(Boolean).join(' · ') || 'Directly in area'}</span>
                      </button>
                      <div className="container-actions"><button aria-label={`Edit ${container.name}`} className="edit-container-button" onClick={() => editContainer(container)} title={`Edit ${container.name}`}><Pencil aria-hidden="true" /></button><button aria-label={`Delete ${container.name}`} className="delete-container-button" disabled={saving} onClick={() => void removeContainer(container)} title={`Delete ${container.name}`}><Trash2 aria-hidden="true" /></button><button className="space-button" onClick={() => void toggleSpace(container)}>{container.is_out_of_space ? 'Mark available' : 'Mark full'}</button></div>
                    </article>
                  )
                })}
                {visibleItems.map((item) => <article className="location-item-row" key={item.id}><div className="container-icon"><Box aria-hidden="true" /></div><button className="container-copy container-open" onClick={() => setSelectedDetailItem(item)}><div><strong>{item.name}</strong><span className="type-badge">Item</span></div><span>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}{item.description ? ` · ${item.description}` : ''}</span></button><ChevronRight aria-hidden="true" /></article>)}
              </div>
            ) : (
              <div className="location-empty"><div className="empty-illustration"><Container aria-hidden="true" /></div><strong>{openContainer ? `${openContainer.name} is empty` : `No containers in ${selectedArea?.name}`}</strong><p>{openContainer ? 'Add a nested container or place items here.' : 'Add a shelf, cabinet, bin, or any other place that can hold household items.'}</p>{openContainer ? <div className="empty-actions"><button className="secondary-action" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add nested container</button><button className="primary-button compact" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</button></div> : <button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add first container</button>}</div>
            )}
          </section>
        </div>
      ) : (
        <div className="location-empty first-area"><div className="empty-illustration"><Warehouse aria-hidden="true" /></div><strong>Create your first area</strong><p>Start with a major physical location such as a garage, attic, shed, trailer, or workshop.</p><button className="primary-button compact" onClick={() => setFormMode('area')}><Plus aria-hidden="true" /> Add area</button></div>
      )}

      {selectedDetailItem ? <ItemDetailsModal item={selectedDetailItem} locationLabel={itemLocation(itemPlacements.find((entry) => entry.item_id === selectedDetailItem.id), areas, zones, containers, placements)} onClose={() => setSelectedDetailItem(null)} onUpdated={(updated) => { setSelectedDetailItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} token={token} /> : null}

      {formMode ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFormMode(null)}>
          <section aria-labelledby="location-dialog-title" aria-modal="true" className="location-dialog" role="dialog">
            <div className="dialog-heading"><div><p className="eyebrow">Location setup</p><h2 id="location-dialog-title">{formMode === 'area' ? 'Add an area' : formMode === 'zone' ? `Add a zone to ${selectedArea?.name}` : formMode === 'edit-zone' ? `Edit ${selectedZone?.name}` : formMode === 'edit-container' ? `Edit ${selectedContainer?.name}` : formMode === 'icon' ? `Choose an icon for ${selectedArea?.name}` : `Add a container to ${selectedArea?.name}`}</h2></div><button aria-label="Close" onClick={() => { setFormMode(null); setSelectedZone(null); setSelectedContainer(null) }}>×</button></div>
            <form onSubmit={formMode === 'area' ? submitArea : formMode === 'zone' ? submitZone : formMode === 'edit-zone' ? submitZoneEdit : formMode === 'edit-container' ? submitContainerEdit : formMode === 'icon' ? submitAreaIcon : submitContainer}>
              {formMode !== 'icon' ? <label>Name<input autoFocus defaultValue={formMode === 'edit-zone' ? selectedZone?.name : formMode === 'edit-container' ? selectedContainer?.name : ''} name="name" placeholder={formMode === 'area' ? 'Garage' : formMode === 'zone' || formMode === 'edit-zone' ? 'North wall' : 'Camping bin'} required /></label> : null}
              {formMode === 'area' || formMode === 'icon' ? <AreaIconPicker defaultValue={formMode === 'icon' ? selectedArea?.icon : undefined} /> : null}
              {formMode === 'container' || formMode === 'edit-container' ? <>
                <div className="form-row">
                  {formMode === 'edit-container' ? <label>Type<input className="readonly-input" readOnly value={CONTAINER_TYPES.find((type) => type.value === selectedContainer?.container_type)?.label ?? 'Other'} /></label> : <label>Type<select defaultValue="bin" name="containerType">{CONTAINER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>}
                  {formMode === 'edit-container' ? <label>Code<input className="readonly-input" readOnly value={selectedContainer?.code ?? ''} /></label> : <div className="generated-code-note"><QrCode aria-hidden="true" /><span><strong>Code generated automatically</strong><small>Based on the selected container type</small></span></div>}
                </div>
                <fieldset className="identifier-picker">
                  <legend>Physical identifier</legend>
                  {([
                    { value: 'qr', label: 'QR code', description: 'Print and scan a label', icon: QrCode },
                    { value: 'nfc', label: 'NFC tag', description: 'Tap with a compatible phone', icon: Radio },
                    { value: 'both', label: 'Both', description: 'Use QR and NFC together', icon: QrCode },
                    { value: 'none', label: 'Neither', description: 'No physical tag', icon: CircleOff },
                  ] as const).map((option) => {
                    const Icon = option.icon
                    return (
                      <label key={option.value}>
                        <input defaultChecked={(selectedContainer?.identifier_type ?? 'none') === option.value} name="identifierType" type="radio" value={option.value} />
                        <span><span className="identifier-option-icons"><Icon aria-hidden="true" />{option.value === 'both' ? <Radio aria-hidden="true" /> : null}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></span>
                      </label>
                    )
                  })}
                </fieldset>
                <label>Zone <span className="optional">Optional</span><select defaultValue={selectedContainer?.zone_id ?? ''} name="zoneId"><option value="">Directly in area</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                <div className="form-row">
                  <label>Parent container <span className="optional">Optional</span><select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.parent_container_id ?? '' : openContainerId ?? ''} name="parentId"><option value="">No parent</option>{containers.filter((container) => container.id !== selectedContainer?.id).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}</select></label>
                  <label>Relationship<select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.relationship_type ?? 'in' : 'in'} name="relationshipType"><option value="in">In</option><option value="on">On</option><option value="under">Under</option><option value="attached_to">Attached to</option></select></label>
                </div>
                <label className="checkbox-label"><input defaultChecked={selectedContainer?.is_movable ?? true} name="isMovable" type="checkbox" /> This container can be moved</label>
              </> : null}
              {formMode !== 'icon' ? <label>Description <span className="optional">Optional</span><textarea defaultValue={formMode === 'edit-zone' ? selectedZone?.description ?? '' : formMode === 'edit-container' ? selectedContainer?.description ?? '' : ''} name="description" placeholder="Add a helpful note…" rows={3} /></label> : null}
              <div className="dialog-actions"><button className="secondary-action" onClick={() => { setFormMode(null); setSelectedZone(null); setSelectedContainer(null) }} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : formMode === 'area' ? 'Create area' : formMode === 'zone' ? 'Create zone' : formMode === 'edit-zone' || formMode === 'edit-container' ? 'Save changes' : formMode === 'icon' ? 'Save icon' : 'Create container'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
      {showNestedItemForm && openContainer ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowNestedItemForm(false)}><section aria-labelledby="nested-item-dialog-title" aria-modal="true" className="location-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Add to {openContainer.name}</p><h2 id="nested-item-dialog-title">Add an item</h2></div><button aria-label="Close" onClick={() => setShowNestedItemForm(false)}>×</button></div><form onSubmit={submitNestedItem}>
        <label>Name<input autoFocus name="name" placeholder="Cordless drill" required /></label>
        <div className="form-row"><label>Quantity<input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><input name="unit" placeholder="pieces, boxes, feet" /></label></div>
        <PhysicalIdentifierPicker />
        <label>Description <span className="optional">Optional</span><textarea name="description" rows={3} /></label>
        <div className="placement-summary"><Container aria-hidden="true" /><span><strong>Placed in {openContainer.name}</strong><small>{openContainer.code}</small></span></div>
        <div className="dialog-actions"><button className="secondary-action" onClick={() => setShowNestedItemForm(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</button></div>
      </form></section></div> : null}
    </div>
  )
}
