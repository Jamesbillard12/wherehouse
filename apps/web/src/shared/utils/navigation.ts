export type SettingsSection = 'account' | 'workspaces' | 'backups' | 'system' | 'preferences' | 'privacy' | 'about'
export type DashboardView = 'overview' | 'items' | 'locations' | 'settings'

export function settingsSectionFromLocation(): SettingsSection {
  const section = location.pathname.split('/')[2]
  return section === 'workspaces' || section === 'backups' || section === 'system' || section === 'preferences' || section === 'privacy' || section === 'about' ? section : 'account'
}

export function viewFromLocation(): DashboardView {
  if (location.pathname === '/items') return 'items'
  if (location.pathname === '/locations') return 'locations'
  return location.pathname.startsWith('/settings') ? 'settings' : 'overview'
}
