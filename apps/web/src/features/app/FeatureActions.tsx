import type { Item } from '@wherehouse/api-client'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type FeatureRequest =
  | { kind: 'create-item'; defaults?: { areaId?: string; zoneId?: string; containerId?: string } }
  | { kind: 'create-area' }
  | { kind: 'create-zone'; defaults?: { areaId?: string } }
  | { kind: 'create-container'; defaults?: { areaId?: string; zoneId?: string; parentContainerId?: string } }
  | { kind: 'item-details'; item: Item }

export type FeatureActions = {
  createItem: (defaults?: Extract<FeatureRequest, { kind: 'create-item' }>['defaults']) => void
  createArea: () => void
  createZone: (defaults?: Extract<FeatureRequest, { kind: 'create-zone' }>['defaults']) => void
  createContainer: (defaults?: Extract<FeatureRequest, { kind: 'create-container' }>['defaults']) => void
  openItem: (item: Item) => void
  close: () => void
}

const FeatureActionsContext = createContext<{ actions: FeatureActions; request: FeatureRequest | null } | null>(null)

export function FeatureActionsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<FeatureRequest | null>(null)
  const actions = useMemo<FeatureActions>(() => ({
    createItem: (defaults) => setRequest({ kind: 'create-item', defaults }),
    createArea: () => setRequest({ kind: 'create-area' }),
    createZone: (defaults) => setRequest({ kind: 'create-zone', defaults }),
    createContainer: (defaults) => setRequest({ kind: 'create-container', defaults }),
    openItem: (item) => setRequest({ kind: 'item-details', item }),
    close: () => setRequest(null),
  }), [])
  return <FeatureActionsContext.Provider value={{ actions, request }}>{children}</FeatureActionsContext.Provider>
}

export function useFeatureActions() {
  const value = useContext(FeatureActionsContext)
  if (!value) throw new Error('useFeatureActions must be used within FeatureActionsProvider')
  return value
}
