import { createWorkspace, getMe, getSystemStatus, listWorkspaces, logout, type Workspace, type MeResponse, type SystemStatus } from '@wherehouse/api-client'
import { useEffect, useState } from 'react'

import { AuthScreen } from './features/auth/AuthScreen'
import { Dashboard } from './features/dashboard/Dashboard'
import { WorkspaceSetup } from './features/workspaces/WorkspaceSetup'
import { message } from './shared/utils/errors'
import { ACTIVE_WORKSPACE_KEY, loadActiveWorkspaceId, SESSION_KEY } from './shared/utils/storage'

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '')
  const [me, setMe] = useState<MeResponse | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedId, setSelectedId] = useState(loadActiveWorkspaceId)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [systemError, setSystemError] = useState<string | null>(null)

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    setToken('')
    setMe(null)
    setWorkspaces([])
    setSelectedId('')
  }

  async function loadAccount(accessToken: string) {
    setLoading(true)
    setError(null)
    try {
      const [account, workspaceList] = await Promise.all([getMe(accessToken), listWorkspaces(accessToken)])
      setMe(account)
      setWorkspaces(workspaceList)
      setSelectedId((current) => workspaceList.some((workspace) => workspace.id === current) ? current : (workspaceList[0]?.id ?? ''))
    } catch (reason) {
      clearSession()
      setError(message(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void getSystemStatus().then(setSystem).catch(() => setSystemError('The server is still starting or needs attention.'))
    if (token) void loadAccount(token)
  }, [])

  function acceptToken(accessToken: string) {
    sessionStorage.setItem(SESSION_KEY, accessToken)
    setToken(accessToken)
    void loadAccount(accessToken)
  }

  async function signOut() {
    try { await logout(token) } finally {
      clearSession()
    }
  }

  async function addWorkspace(name: string) {
    const workspace = await createWorkspace(token, name)
    setWorkspaces((current) => [...current, workspace])
    setSelectedId(workspace.id)
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id)
    setMe(await getMe(token))
  }

  if (token && loading && !me) {
    return (
      <main aria-label="Loading WhereHouse" aria-live="polite" className="app-bootstrap" role="status">
        <img alt="WhereHouse" className="brand-logo" src="/logo.png" />
        <span>Loading your household…</span>
      </main>
    )
  }
  if (!token || !me) return <AuthScreen busy={loading} initialError={error} onAuthenticated={acceptToken} system={system} systemError={systemError} />
  if (!workspaces.length) return <WorkspaceSetup system={system} token={token} user={me} onCreate={addWorkspace} onSignOut={signOut} />

  const selected = workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0]
  const membership = me.workspaces.find((access) => access.workspace_id === selected.id)
  return <Dashboard workspace={selected} workspaces={workspaces} isOwner={membership?.role === 'owner'} onCreateWorkspace={addWorkspace} onSelect={(id) => { setSelectedId(id); localStorage.setItem(ACTIVE_WORKSPACE_KEY, id) }} onSignOut={signOut} token={token} user={me} />
}
