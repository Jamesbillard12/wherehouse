import { listAreas, listContainerPlacements, listContainers, listItemPlacements, listItems, listZones, type Area, type ContainerPlacement, type Item, type ItemPlacement, type StorageContainer, type Zone } from '@wherehouse/api-client'
import { useEffect, useState } from 'react'

import { message } from '../../shared/utils/errors'

export type OverviewInventory = {
  areas: Area[]
  zones: Zone[]
  containers: StorageContainer[]
  containerPlacements: ContainerPlacement[]
  items: Item[]
  itemPlacements: ItemPlacement[]
  loading: boolean
  error: string | null
}

const EMPTY: OverviewInventory = { areas: [], zones: [], containers: [], containerPlacements: [], items: [], itemPlacements: [], loading: true, error: null }

export function useOverviewInventory(householdId: string, token: string, refreshKey = 0): OverviewInventory {
  const [inventory, setInventory] = useState<OverviewInventory>(EMPTY)

  useEffect(() => {
    let cancelled = false
    setInventory((current) => ({ ...current, loading: true, error: null }))
    async function load() {
      const [areas, items, itemPlacements] = await Promise.all([listAreas(token, householdId), listItems(token, householdId), listItemPlacements(token, householdId)])
      const details = await Promise.all(areas.map(async (area) => {
        const [zones, containers, containerPlacements] = await Promise.all([listZones(token, area.id), listContainers(token, area.id), listContainerPlacements(token, area.id)])
        return { zones, containers, containerPlacements }
      }))
      if (!cancelled) setInventory({ areas, items, itemPlacements, zones: details.flatMap((detail) => detail.zones), containers: details.flatMap((detail) => detail.containers), containerPlacements: details.flatMap((detail) => detail.containerPlacements), loading: false, error: null })
    }
    void load().catch((reason) => !cancelled && setInventory((current) => ({ ...current, loading: false, error: message(reason) })))
    return () => { cancelled = true }
  }, [householdId, refreshKey, token])

  return inventory
}
