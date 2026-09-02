import {
  createArea, createContainer, createItem, createZone, listAreas, listContainerPlacements,
  listContainers, listZones, uploadItemImage, type Area, type ContainerPlacement,
  type Household, type StorageContainer, type Zone,
} from '@wherehouse/api-client'
import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateImageField } from '../../components/wherehouse/CreateImageField'
import { message } from '../../shared/utils/errors'
import { AddItemDialog } from '../items/ItemsView'
import { PhysicalIdentifierPicker } from '../items/PhysicalIdentifierPicker'
import { AreaIconPicker, CONTAINER_TYPES } from '../locations/locationOptions'
import { useFeatureActions } from './FeatureActions'

export function GlobalFeatureHost({ household, onChanged, token }: { household: Household; onChanged: () => void; token: string }) {
  const { actions, request } = useFeatureActions()
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [placements, setPlacements] = useState<ContainerPlacement[]>([])
  const [areaId, setAreaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!request || request.kind === 'item-details') return
    let cancelled = false
    void listAreas(token, household.id).then(async (nextAreas) => {
      if (cancelled) return
      setAreas(nextAreas)
      const requestedArea = 'defaults' in request ? request.defaults?.areaId : undefined
      const selected = requestedArea && nextAreas.some((area) => area.id === requestedArea) ? requestedArea : nextAreas[0]?.id ?? ''
      setAreaId(selected)
      const details = await Promise.all(nextAreas.map(async (area) => {
        const [areaZones, areaContainers, areaPlacements] = await Promise.all([listZones(token, area.id), listContainers(token, area.id), listContainerPlacements(token, area.id)])
        return { areaZones, areaContainers, areaPlacements }
      }))
      if (!cancelled) {
        setZones(details.flatMap((detail) => detail.areaZones))
        setContainers(details.flatMap((detail) => detail.areaContainers))
        setPlacements(details.flatMap((detail) => detail.areaPlacements))
      }
    }).catch((reason) => !cancelled && setError(message(reason)))
    return () => { cancelled = true }
  }, [household.id, request, token])

  async function submitItem(event: FormEvent<HTMLFormElement>, image: File | null) {
    event.preventDefault(); setSaving(true); setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const target = String(data.get('placement'))
      const [targetType, targetId] = target.split(':')
      let item = await createItem(token, household.id, {
        name: String(data.get('name')).trim(), quantity: Number(data.get('quantity')),
        identifier_type: String(data.get('identifierType')) as 'qr' | 'nfc' | 'both' | 'none',
        unit: String(data.get('unit')).trim() || undefined, manufacturer: String(data.get('manufacturer')).trim() || undefined,
        model: String(data.get('model')).trim() || undefined, description: String(data.get('description')).trim() || undefined,
        ...(target ? { placement: { [`${targetType}_id`]: targetId, ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}) } } : {}),
      })
      if (image?.size) item = await uploadItemImage(token, item.id, image)
      actions.close(); onChanged()
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!request || request.kind === 'create-item' || request.kind === 'item-details') return
    setSaving(true); setError(null); const data = new FormData(event.currentTarget)
    try {
      if (request.kind === 'create-area') await createArea(token, household.id, { name: String(data.get('name')).trim(), icon: String(data.get('icon')), description: String(data.get('description')).trim() || undefined })
      if (request.kind === 'create-zone') await createZone(token, String(data.get('areaId')), { name: String(data.get('name')).trim(), description: String(data.get('description')).trim() || undefined })
      if (request.kind === 'create-container') await createContainer(token, { area_id: String(data.get('areaId')), zone_id: String(data.get('zoneId')) || undefined, name: String(data.get('name')).trim(), container_type: String(data.get('containerType')) as typeof CONTAINER_TYPES[number]['value'], identifier_type: String(data.get('identifierType')) as 'qr' | 'nfc' | 'both' | 'none', description: String(data.get('description')).trim() || undefined, is_movable: true })
      actions.close(); onChanged()
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  if (!request || request.kind === 'item-details') return null
  if (request.kind === 'create-item') return <><AddItemDialog areas={areas} containerPlacements={placements} containers={containers} eyebrow="Quick create" onOpenChange={(open) => { if (!open) actions.close() }} onSubmit={submitItem} open saving={saving} zones={zones} />{error ? <div className="alert global-feature-error">{error}</div> : null}</>
  const selectedZones = zones.filter((zone) => zone.area_id === areaId)
  return <Dialog open onOpenChange={(open) => { if (!open) actions.close() }}><DialogContent className="location-dialog w-[calc(100%-3rem)] max-w-[calc(100%-3rem)] gap-0 overflow-y-auto p-0 sm:w-[720px] sm:max-w-[720px]" showCloseButton={false}><DialogHeader className="dialog-heading flex-row"><div><p className="eyebrow">Quick create</p><DialogTitle>{request.kind === 'create-area' ? 'Add an area' : request.kind === 'create-zone' ? 'Add a zone' : 'Add a container'}</DialogTitle></div><DialogClose render={<Button size="icon" variant="secondary" />}>×</DialogClose></DialogHeader><form onSubmit={submitLocation}>
    {request.kind !== 'create-area' ? <label>Area<select name="areaId" onChange={(event) => setAreaId(event.target.value)} value={areaId}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label> : null}
    <label>Name<input autoFocus name="name" required /></label>
    {request.kind === 'create-area' ? <AreaIconPicker /> : null}
    {request.kind === 'create-container' ? <><div className="form-row"><label>Type<select defaultValue="bin" name="containerType">{CONTAINER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Zone <span className="optional">Optional</span><select defaultValue={request.defaults?.zoneId ?? ''} name="zoneId"><option value="">Directly in area</option>{selectedZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label></div><PhysicalIdentifierPicker /></> : null}
    <label>Description <span className="optional">Optional</span><textarea name="description" rows={3} /></label>
    {error ? <div className="alert">{error}</div> : null}<div className="dialog-actions"><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button disabled={saving || (request.kind !== 'create-area' && !areaId)} type="submit">{saving ? 'Saving…' : 'Create'}</Button></div>
  </form></DialogContent></Dialog>
}
