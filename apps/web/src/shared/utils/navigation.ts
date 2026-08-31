export type DashboardView = 'overview' | 'items' | 'locations'

export function viewFromLocation(): DashboardView {
  if (location.pathname === '/items') return 'items'
  return location.pathname === '/locations' ? 'locations' : 'overview'
}
