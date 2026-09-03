export const SESSION_KEY = 'wherehouse.web.session'
export const SIDEBAR_KEY = 'wherehouse.web.sidebar-collapsed'
export const ACTIVE_WORKSPACE_KEY = 'wherehouse.web.selected-workspace'
const LEGACY_HOUSEHOLD_KEY = 'wherehouse.web.selected-household'

export function loadActiveWorkspaceId(): string {
  const current = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  if (current) return current
  const legacy = localStorage.getItem(LEGACY_HOUSEHOLD_KEY) ?? ''
  if (legacy) localStorage.setItem(ACTIVE_WORKSPACE_KEY, legacy)
  return legacy
}

export function areaKey(workspaceId: string): string {
  return `wherehouse.web.selected-area.${workspaceId}`
}
