import {
  createArea,
  createContainer,
  createItem,
  createZone,
  deleteArea,
  deleteContainer,
  getContainerImage,
  listAreas,
  listContainerPlacements,
  listContainers,
  listItemPlacements,
  listItems,
  listZones,
  placeContainer,
  removeContainerPlacement,
  setContainerSpace,
  updateArea,
  updateContainer,
  uploadContainerImage,
  uploadItemImage,
  updateZone,
  type Area,
  type ContainerPlacement,
  type ContainerType,
  type Workspace,
  type Item,
  type ItemPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import {
  Building2,
  Caravan,
  ChevronRight,
  CircleOff,
  Container,
  Camera,
  Image as ImageIcon,
  Hammer,
  House,
  MapPin,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Radio,
  Trash2,
  TreePine,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { ItemDetailsModal, itemLocation } from '../items/ItemsView'
import { PhysicalIdentifierPicker } from '../items/PhysicalIdentifierPicker'
import { message } from '../../shared/utils/errors'
import { areaKey } from '../../shared/utils/storage'
import { AreaIcon, AreaIconPicker, CONTAINER_TYPES } from './locationOptions'
import { ContainerLabelModal } from './ContainerLabelModal'
import { LocationContentsList } from '../../components/wherehouse/LocationContentsList'
import { ConfirmDialog } from '../../components/wherehouse/ConfirmDialog'
import { CreateImageField } from '../../components/wherehouse/CreateImageField'
import { ImageCropDialog } from '../../components/wherehouse/ImageCropDialog'
import { PageHeader } from '../../components/wherehouse/PageHeader'

export { AreaIcon } from './locationOptions'
export function LocationsView({ createRequest, workspace, onRevealConsumed, refreshKey = 0, revealAreaId, revealContainerId, revealItem, revealItemId, revealScanKey, revealZoneId, token }: { createRequest?: { key: number; type: 'area' | 'zone' | 'container' }; workspace: Workspace; onRevealConsumed?: () => void; refreshKey?: number; revealAreaId?: string; revealContainerId?: string; revealItem?: Item; revealItemId?: string; revealScanKey?: string; revealZoneId?: string; token: string }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [placements, setPlacements] = useState<ContainerPlacement[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [itemPlacements, setItemPlacements] = useState<ItemPlacement[]>([])
  const [openContainerId, setOpenContainerId] = useState<string | null>(null)
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [formMode, setFormMode] = useState<'area' | 'edit-area' | 'zone' | 'edit-zone' | 'container' | 'edit-container' | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [containerFormZoneId, setContainerFormZoneId] = useState('')
  const [containerFormParentId, setContainerFormParentId] = useState('')
  const [containerImageUrl, setContainerImageUrl] = useState('')
  const [containerImageBusy, setContainerImageBusy] = useState(false)
  const [containerImageRevision, setContainerImageRevision] = useState(0)
  const [containerImageToCrop, setContainerImageToCrop] = useState<File | null>(null)
  const [newContainerImage, setNewContainerImage] = useState<File | null>(null)
  const [showContainerLabel, setShowContainerLabel] = useState(false)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null)
  const [selectedItemMode, setSelectedItemMode] = useState<'details' | 'edit' | 'delete'>('details')
  const [showNestedItemForm, setShowNestedItemForm] = useState(false)
  const [newNestedItemImage, setNewNestedItemImage] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'area'; name: string; description: string } | { type: 'container'; container: StorageContainer; description: string } | null>(null)
  const handledCreateRequest = useRef(0)

  async function loadAreas(preferredId?: string) {
    const nextAreas = await listAreas(token, workspace.id)
    setAreas(nextAreas)
    setSelectedAreaId((current) => {
      const candidate = preferredId || current || localStorage.getItem(areaKey(workspace.id)) || ''
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
      listItems(token, workspace.id),
      listItemPlacements(token, workspace.id),
    ])
    setZones(nextZones)
    setContainers(nextContainers)
    setPlacements(nextPlacements)
    setItems(nextItems)
    setSelectedDetailItem((current) => current ? nextItems.find((item) => item.id === current.id) ?? null : null)
    setItemPlacements(nextItemPlacements)
  }

  useEffect(() => {
    setLoading(true)
  }, [workspace.id, token])

  useEffect(() => {
    setError(null)
    void loadAreas()
      .catch((reason) => setError(message(reason)))
      .finally(() => setLoading(false))
  }, [workspace.id, refreshKey, token])

  useEffect(() => {
    setOpenContainerId(null)
    setSelectedZoneFilter('')
    if (selectedAreaId) localStorage.setItem(areaKey(workspace.id), selectedAreaId)
  }, [workspace.id, selectedAreaId])

  useEffect(() => {
    setError(null)
    void loadAreaDetails(selectedAreaId).catch((reason) => setError(message(reason)))
  }, [workspace.id, refreshKey, selectedAreaId, token])

  useEffect(() => {
    if (formMode !== 'container' && formMode !== 'edit-container') return
    const placement = selectedContainer
      ? placements.find((entry) => entry.container_id === selectedContainer.id)
      : null
    const parentId = placement?.parent_container_id ?? openContainerId ?? ''
    const parent = containers.find((entry) => entry.id === parentId)
    setContainerFormZoneId(selectedContainer?.zone_id ?? parent?.zone_id ?? selectedZoneFilter)
    setContainerFormParentId(parentId)
  }, [formMode, selectedContainer, openContainerId, placements, containers, selectedZoneFilter])

  useEffect(() => {
    if (!createRequest || createRequest.key === handledCreateRequest.current) return
    if (createRequest.type !== 'area' && !selectedAreaId) return
    handledCreateRequest.current = createRequest.key
    setFormMode(createRequest.type)
  }, [createRequest, selectedAreaId])

  useEffect(() => {
    if (!revealItemId) return
    const item = revealItem ?? items.find((entry) => entry.id === revealItemId)
    if (!item) return
    if (revealAreaId && revealAreaId !== selectedAreaId) {
      setSelectedAreaId(revealAreaId)
      return
    }
    if (revealContainerId) {
      if (!containers.some((entry) => entry.id === revealContainerId)) return
      setSelectedZoneFilter('')
      setOpenContainerId(revealContainerId)
    } else if (revealZoneId) {
      if (!zones.some((entry) => entry.id === revealZoneId)) return
      setSelectedZoneFilter(revealZoneId)
      setOpenContainerId(null)
    } else if (revealAreaId) {
      setSelectedZoneFilter('')
      setOpenContainerId(null)
    }
    setSelectedDetailItem(item)
    setSelectedItemMode('details')
    onRevealConsumed?.()
  }, [containers, items, onRevealConsumed, revealAreaId, revealContainerId, revealItem, revealItemId, revealScanKey, revealZoneId, selectedAreaId, zones])

  useEffect(() => {
    if (revealItemId) return
    if (!revealAreaId) return
    if (revealAreaId !== selectedAreaId) {
      setSelectedAreaId(revealAreaId)
      return
    }
    if (revealZoneId) {
      if (!zones.some((zone) => zone.id === revealZoneId)) return
      setSelectedZoneFilter(revealZoneId)
      setOpenContainerId(null)
      onRevealConsumed?.()
      return
    }
    if (!revealContainerId) {
      setSelectedZoneFilter('')
      setOpenContainerId(null)
      onRevealConsumed?.()
      return
    }
    const container = containers.find((entry) => entry.id === revealContainerId)
    if (container) {
      if (container.area_id !== selectedAreaId) setSelectedAreaId(container.area_id)
      else {
        setOpenContainerId(container.id)
        onRevealConsumed?.()
      }
    }
  }, [containers, onRevealConsumed, revealAreaId, revealContainerId, revealItemId, revealScanKey, revealZoneId, selectedAreaId, zones])

  async function submitArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const area = await createArea(token, workspace.id, {
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

  async function submitAreaEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArea) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const description = String(data.get('description')).trim()
      const updated = await updateArea(token, selectedArea.id, {
        name: String(data.get('name')).trim(),
        icon: String(data.get('icon')),
        description: description || null,
      })
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
    setDeleteTarget({ type: 'area', name: selectedArea.name, description: `${detail.trim()}${detail ? ' ' : ''}This cannot be undone.` })
  }

  async function confirmRemoveArea() {
    if (!selectedArea) return
    setSaving(true)
    setError(null)
    try {
      await deleteArea(token, selectedArea.id)
      await loadAreas()
      setDeleteTarget(null)
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
      let container = await createContainer(token, {
        area_id: selectedAreaId,
        zone_id: String(data.get('zoneId')) || undefined,
        name: String(data.get('name')).trim(),
        container_type: String(data.get('containerType')) as ContainerType,
        identifier_type: String(data.get('identifierType')) as StorageContainer['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        is_movable: data.get('isMovable') === 'on',
      })
      if (newContainerImage?.size) container = await uploadContainerImage(token, container.id, newContainerImage)
      const parentId = String(data.get('parentId'))
      if (parentId) {
        await placeContainer(token, container.id, {
          parent_container_id: parentId,
          relationship_type: String(data.get('relationshipType')) as ContainerPlacement['relationship_type'],
        })
      }
      await loadAreaDetails(selectedAreaId)
      setNewContainerImage(null)
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

  useEffect(() => {
    if (!selectedContainer?.image_path || formMode !== 'edit-container') {
      setContainerImageUrl('')
      return
    }
    let active = true
    let objectUrl = ''
    void getContainerImage(token, selectedContainer.id).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setContainerImageUrl(objectUrl)
    }).catch((reason) => active && setError(message(reason)))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [containerImageRevision, formMode, refreshKey, selectedContainer?.id, selectedContainer?.image_path, token])

  async function changeContainerImage(file: File | undefined) {
    if (!file || !selectedContainer) return
    setContainerImageBusy(true)
    setError(null)
    try {
      const updated = await uploadContainerImage(token, selectedContainer.id, file)
      setSelectedContainer(updated)
      setContainers((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
      setContainerImageRevision((current) => current + 1)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setContainerImageBusy(false)
    }
  }

  async function removeContainer(container: StorageContainer) {
    const childCount = placements.filter(
      (placement) => placement.parent_container_id === container.id,
    ).length
    const childWarning = childCount
      ? ` ${childCount} nested container${childCount === 1 ? '' : 's'} will remain in the area without this parent.`
      : ''
    setDeleteTarget({ type: 'container', container, description: `${childWarning.trim()}${childWarning ? ' ' : ''}Item placements in this container will be cleared. This cannot be undone.` })
  }

  async function confirmRemoveContainer(container: StorageContainer) {
    setSaving(true)
    setError(null)
    try {
      await deleteContainer(token, container.id)
      await loadAreaDetails(selectedAreaId)
      setDeleteTarget(null)
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
      let item = await createItem(token, workspace.id, {
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as Item['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
        placement: { container_id: openContainerId, relationship_type: 'in' },
      })
      if (newNestedItemImage?.size) item = await uploadItemImage(token, item.id, newNestedItemImage)
      await loadAreaDetails(selectedAreaId)
      setNewNestedItemImage(null)
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
  function itemQuantityInContainer(containerId: string): number {
    const containedIds = new Set([containerId])
    let addedDescendant = true
    while (addedDescendant) {
      addedDescendant = false
      for (const placement of placements) {
        if (placement.parent_container_id && containedIds.has(placement.parent_container_id) && !containedIds.has(placement.container_id)) {
          containedIds.add(placement.container_id)
          addedDescendant = true
        }
      }
    }
    return items.reduce((total, item) => {
      const placement = itemPlacements.find((entry) => entry.item_id === item.id)
      return placement?.container_id && containedIds.has(placement.container_id)
        ? total + Number(item.quantity)
        : total
    }, 0)
  }

  return (
    <div className="locations-view">
      <PageHeader description="Organize areas, zones, and every container inside them." eyebrow="Storage map" title="Locations" />

      {error && !deleteTarget ? <div className="alert locations-alert">{error}</div> : null}

      {loading ? <div className="locations-loading">Loading locations…</div> : areas.length ? (
        <div className="locations-layout">
          <aside className="area-list" aria-label="Areas">
            <div className="section-title">
              <span>Areas <strong>{areas.length}</strong></span>
              <Button aria-label="Add area" onClick={() => setFormMode('area')} title="Add area"><Plus aria-hidden="true" /></Button>
            </div>
            {areas.map((area) => {
              const count = area.id === selectedAreaId ? containers.length : null
              return (
                <Button className={area.id === selectedAreaId ? 'selected' : ''} key={area.id} onClick={() => setSelectedAreaId(area.id)}>
                  <span className="area-icon"><AreaIcon name={area.icon} /></span>
                  <span><strong>{area.name}</strong><small>{count === null ? 'Open area' : `${zones.length} zones · ${count} containers`}</small></span>
                  <ChevronRight aria-hidden="true" />
                </Button>
              )
            })}
          </aside>

          <section className="area-detail">
            <div className="area-detail-heading">
              <div className="selected-area-title">
                <span className="area-icon large"><AreaIcon name={selectedArea?.icon ?? 'warehouse'} /></span>
                <div><p className="eyebrow">Selected area</p><div className="area-name"><h2>{selectedArea?.name}</h2><Button aria-label={`Rename ${selectedArea?.name}`} onClick={() => setFormMode('edit-area')} title="Rename area"><Pencil aria-hidden="true" /></Button></div>{selectedArea?.description ? <p>{selectedArea.description}</p> : null}</div>
              </div>
              <div className="area-actions">
                <Button className="secondary-action" onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</Button>
                <Button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</Button>
                <Button aria-label={`Delete ${selectedArea?.name}`} className="icon-action danger" disabled={saving} onClick={() => void removeArea()} title="Delete area"><Trash2 aria-hidden="true" /></Button>
              </div>
            </div>

            {zones.length ? (
              <div className="zone-chips">
                <span>Zones</span>
                <Button className={`zone-filter ${selectedZoneFilter === '' ? 'selected' : ''}`} onClick={() => { setSelectedZoneFilter(''); setOpenContainerId(null) }}>All</Button>
                {zones.map((zone) => <span className={`zone-chip ${selectedZoneFilter === zone.id ? 'selected' : ''}`} key={zone.id}><Button className="zone-filter-name" onClick={() => { setSelectedZoneFilter(zone.id); setOpenContainerId(null) }}>{zone.name}</Button><Button aria-label={`Edit ${zone.name}`} onClick={() => editZone(zone)} title={`Edit ${zone.name}`}><Pencil aria-hidden="true" /></Button></span>)}
                <Button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</Button>
              </div>
            ) : <div className="empty-strip"><span><MapPin aria-hidden="true" /> No zones yet. Add one to describe a shelf wall, workbench, or other section.</span><Button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</Button></div>}

            {openContainer ? <div className="container-breadcrumb"><Button className="back-button" onClick={() => setOpenContainerId(placementByContainer.get(openContainer.id)?.parent_container_id ?? null)}>← Back</Button><nav aria-label="Container location" className="container-path">{openContainerTrail.map((container, index) => <span className="path-segment" key={container.id}>{index ? <ChevronRight aria-hidden="true" /> : null}{index < openContainerTrail.length - 1 ? <Button onClick={() => setOpenContainerId(container.id)}>{container.name}</Button> : <strong>{container.name}</strong>}</span>)}</nav><small>{openContainer.code}</small><div className="nested-actions"><Button className="add-nested-button" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</Button><Button className="add-nested-button" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</Button></div></div> : null}

            {visibleContainers.length || visibleItems.length ? (
              <LocationContentsList
                containers={visibleContainers.map((container) => {
                  const placement = placementByContainer.get(container.id)
                  const parent = placement ? containerById.get(placement.parent_container_id) : null
                  const zone = zones.find((entry) => entry.id === container.zone_id)
                  return { container, itemQuantity: itemQuantityInContainer(container.id), locationDescription: [zone?.name, parent ? `${placement?.relationship_type.replace('_', ' ')} ${parent.name}` : null, container.code].filter(Boolean).join(' · ') || 'Directly in area' }
                })}
                items={visibleItems}
                onDeleteContainer={(container) => void removeContainer(container)}
                onDeleteItem={(item) => { setSelectedItemMode('delete'); setSelectedDetailItem(item) }}
                onEditContainer={editContainer}
                onEditItem={(item) => { setSelectedItemMode('edit'); setSelectedDetailItem(item) }}
                onOpenContainer={(container) => setOpenContainerId(container.id)}
                onOpenItem={(item) => { setSelectedItemMode('details'); setSelectedDetailItem(item) }}
                onToggleContainerSpace={(container) => void toggleSpace(container)}
                saving={saving}
              />
            ) : (
              <div className="location-empty"><div className="empty-illustration"><Container aria-hidden="true" /></div><strong>{openContainer ? `${openContainer.name} is empty` : `No containers in ${selectedArea?.name}`}</strong><p>{openContainer ? 'Add a nested container or place items here.' : 'Add a shelf, cabinet, bin, or any other place that can hold workspace items.'}</p>{openContainer ? <div className="empty-actions"><Button className="secondary-action" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add nested container</Button><Button className="primary-button compact" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</Button></div> : <Button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add first container</Button>}</div>
            )}
          </section>
        </div>
      ) : (
        <div className="location-empty first-area"><div className="empty-illustration"><Warehouse aria-hidden="true" /></div><strong>Create your first area</strong><p>Start with a major physical location such as a garage, attic, shed, trailer, or workshop.</p><Button className="primary-button compact" onClick={() => setFormMode('area')}><Plus aria-hidden="true" /> Add area</Button></div>
      )}

      {selectedDetailItem ? <ItemDetailsModal areas={areas} containerPlacements={placements} containers={containers} imageRevision={refreshKey} initialMode={selectedItemMode} item={selectedDetailItem} locationLabel={itemLocation(itemPlacements.find((entry) => entry.item_id === selectedDetailItem.id), areas, zones, containers, placements)} onClose={() => setSelectedDetailItem(null)} onDeleted={(itemId) => { setSelectedDetailItem(null); setItems((current) => current.filter((item) => item.id !== itemId)); setItemPlacements((current) => current.filter((entry) => entry.item_id !== itemId)) }} onPlacementUpdated={(updated) => setItemPlacements((current) => [...current.filter((entry) => entry.item_id !== updated.item_id), updated])} onUpdated={(updated) => { setSelectedDetailItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} placement={itemPlacements.find((entry) => entry.item_id === selectedDetailItem.id)} token={token} zones={zones} /> : null}

      {formMode ? (
        <Dialog open onOpenChange={(open) => { if (!open && !saving) { setNewContainerImage(null); setFormMode(null); setSelectedZone(null); setSelectedContainer(null) } }}>
          <DialogContent className="location-dialog max-w-[calc(100%-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]" showCloseButton={false}>
            <DialogHeader className="dialog-heading flex-row"><div><p className="eyebrow">Location setup</p><DialogTitle>{formMode === 'area' ? 'Add an area' : formMode === 'edit-area' ? `Edit ${selectedArea?.name}` : formMode === 'zone' ? `Add a zone to ${selectedArea?.name}` : formMode === 'edit-zone' ? `Edit ${selectedZone?.name}` : formMode === 'edit-container' ? `Edit ${selectedContainer?.name}` : `Add a container to ${selectedArea?.name}`}</DialogTitle><DialogDescription className="sr-only">Enter the location details.</DialogDescription></div><DialogClose aria-label="Close location dialog" disabled={saving} render={<Button size="icon" variant="secondary" />}>×</DialogClose></DialogHeader>
            <form onSubmit={formMode === 'area' ? submitArea : formMode === 'edit-area' ? submitAreaEdit : formMode === 'zone' ? submitZone : formMode === 'edit-zone' ? submitZoneEdit : formMode === 'edit-container' ? submitContainerEdit : submitContainer}>
              {formMode === 'edit-container' ? <div className="item-image-panel container-image-panel">{containerImageUrl ? <img alt={selectedContainer?.name} src={containerImageUrl} /> : <div className="item-image-placeholder"><ImageIcon aria-hidden="true" /><strong>No image yet</strong><span>Add a photo to make this container easier to identify.</span></div>}<label className="item-image-action"><Camera aria-hidden="true" /><span>{containerImageBusy ? 'Uploading…' : containerImageUrl ? 'Replace image' : 'Add image'}</span><input accept="image/jpeg,image/png,image/webp" disabled={containerImageBusy} onChange={(event) => { setContainerImageToCrop(event.target.files?.[0] ?? null); event.target.value = '' }} type="file" /></label></div> : null}
              {formMode === 'container' ? <CreateImageField label="Container image" onFileChange={setNewContainerImage} /> : null}
              <label>Name<Input autoFocus defaultValue={formMode === 'edit-area' ? selectedArea?.name : formMode === 'edit-zone' ? selectedZone?.name : formMode === 'edit-container' ? selectedContainer?.name : ''} name="name" placeholder={formMode === 'area' ? 'Garage' : formMode === 'zone' || formMode === 'edit-zone' ? 'North wall' : 'Camping bin'} required /></label>
              {formMode === 'area' || formMode === 'edit-area' ? <AreaIconPicker defaultValue={formMode === 'edit-area' ? selectedArea?.icon : undefined} /> : null}
              {formMode === 'container' || formMode === 'edit-container' ? <>
                <div className="form-row">
                  {formMode === 'edit-container' ? <label>Type<Input className="readonly-input" readOnly value={CONTAINER_TYPES.find((type) => type.value === selectedContainer?.container_type)?.label ?? 'Other'} /></label> : <label>Type<select defaultValue="bin" name="containerType">{CONTAINER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>}
                  {formMode === 'edit-container' ? <label>Code<Input className="readonly-input" readOnly value={selectedContainer?.code ?? ''} /></label> : <div className="generated-code-note"><QrCode aria-hidden="true" /><span><strong>Code generated automatically</strong><small>Based on the selected container type</small></span></div>}
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
                <label>Zone <span className="optional">Optional</span><select name="zoneId" onChange={(event) => {
                  const zoneId = event.target.value
                  setContainerFormZoneId(zoneId)
                  const parent = containers.find((entry) => entry.id === containerFormParentId)
                  if (parent && (parent.zone_id ?? '') !== zoneId) setContainerFormParentId('')
                }} value={containerFormZoneId}><option value="">Directly in area</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                <div className="form-row">
                  <label>Parent container <span className="optional">Optional</span><select name="parentId" onChange={(event) => setContainerFormParentId(event.target.value)} value={containerFormParentId}><option value="">No parent</option>{containers.filter((container) => container.id !== selectedContainer?.id && (container.zone_id ?? '') === containerFormZoneId).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}</select></label>
                  <label>Relationship<select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.relationship_type ?? 'in' : 'in'} name="relationshipType"><option value="in">In</option><option value="on">On</option><option value="under">Under</option><option value="attached_to">Attached to</option></select></label>
                </div>
                <label className="checkbox-label"><input defaultChecked={selectedContainer?.is_movable ?? true} name="isMovable" type="checkbox" /> This container can be moved</label>
              </> : null}
              <label>Description <span className="optional">Optional</span><Textarea defaultValue={formMode === 'edit-area' ? selectedArea?.description ?? '' : formMode === 'edit-zone' ? selectedZone?.description ?? '' : formMode === 'edit-container' ? selectedContainer?.description ?? '' : ''} name="description" placeholder="Add a helpful note…" rows={3} /></label>
              <div className="dialog-actions"><DialogClose disabled={saving} render={<Button type="button" variant="outline" />}>Cancel</DialogClose>{formMode === 'edit-container' ? <Button onClick={() => setShowContainerLabel(true)} type="button" variant="outline"><Printer aria-hidden="true" /> Print QR</Button> : null}<Button pending={saving} type="submit">{saving ? 'Saving…' : formMode === 'area' ? 'Create area' : formMode === 'zone' ? 'Create zone' : formMode === 'edit-area' || formMode === 'edit-zone' || formMode === 'edit-container' ? 'Save changes' : 'Create container'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      {showContainerLabel && selectedContainer ? <ContainerLabelModal container={selectedContainer} onClose={() => setShowContainerLabel(false)} token={token} /> : null}
      <ImageCropDialog file={containerImageToCrop} onCancel={() => setContainerImageToCrop(null)} onConfirm={(file) => { setContainerImageToCrop(null); void changeContainerImage(file) }} />
      {showNestedItemForm && openContainer ? <Dialog open onOpenChange={(open) => { if (!open && !saving) { setNewNestedItemImage(null); setShowNestedItemForm(false) } }}><DialogContent className="location-dialog max-w-[calc(100%-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]" showCloseButton={false}><DialogHeader className="dialog-heading flex-row"><div><p className="eyebrow">Add to {openContainer.name}</p><DialogTitle>Add an item</DialogTitle><DialogDescription className="sr-only">Create an item directly in this container.</DialogDescription></div><DialogClose aria-label="Close add item dialog" disabled={saving} render={<Button size="icon" variant="secondary" />}>×</DialogClose></DialogHeader><form onSubmit={submitNestedItem}>
        <CreateImageField label="Item image" onFileChange={setNewNestedItemImage} />
        <label>Name<Input autoFocus name="name" placeholder="Cordless drill" required /></label>
        <div className="form-row"><label>Quantity<Input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><Input name="unit" placeholder="pieces, boxes, feet" /></label></div>
        <PhysicalIdentifierPicker />
        <label>Description <span className="optional">Optional</span><Textarea name="description" rows={3} /></label>
        <div className="placement-summary"><Container aria-hidden="true" /><span><strong>Placed in {openContainer.name}</strong><small>{openContainer.code}</small></span></div>
        <div className="dialog-actions"><DialogClose disabled={saving} render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button pending={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</Button></div>
      </form></DialogContent></Dialog> : null}
      <ConfirmDialog
        busy={saving}
        confirmLabel={deleteTarget?.type === 'area' ? 'Delete area' : 'Delete container'}
        description={deleteTarget?.description ?? ''}
        destructive
        error={error}
        onCancel={() => { setDeleteTarget(null); setError(null) }}
        onConfirm={() => deleteTarget?.type === 'area' ? confirmRemoveArea() : deleteTarget ? confirmRemoveContainer(deleteTarget.container) : undefined}
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'area' ? `Delete ${deleteTarget.name}?` : deleteTarget ? `Delete ${deleteTarget.container.name} (${deleteTarget.container.code})?` : 'Delete location?'}
      />
    </div>
  )
}
