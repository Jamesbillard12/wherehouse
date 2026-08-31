export const SESSION_KEY = 'wherehouse.web.session'
export const SIDEBAR_KEY = 'wherehouse.web.sidebar-collapsed'
export const HOUSEHOLD_KEY = 'wherehouse.web.selected-household'

export function areaKey(householdId: string): string {
  return `wherehouse.web.selected-area.${householdId}`
}
