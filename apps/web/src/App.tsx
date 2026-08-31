import { createHousehold, getMe, listHouseholds, logout, type Household, type MeResponse } from '@wherehouse/api-client'
import { useEffect, useState } from 'react'

import { AuthScreen } from './features/auth/AuthScreen'
import { Dashboard } from './features/dashboard/Dashboard'
import { HouseholdSetup } from './features/households/HouseholdSetup'
import { message } from './shared/utils/errors'
import { HOUSEHOLD_KEY, SESSION_KEY } from './shared/utils/storage'

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '')
  const [me, setMe] = useState<MeResponse | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(HOUSEHOLD_KEY) ?? '')
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)

  async function loadAccount(accessToken: string) {
    setLoading(true)
    setError(null)
    try {
      const [account, householdList] = await Promise.all([getMe(accessToken), listHouseholds(accessToken)])
      setMe(account)
      setHouseholds(householdList)
      setSelectedId((current) => householdList.some((household) => household.id === current) ? current : (householdList[0]?.id ?? ''))
    } catch (reason) {
      sessionStorage.removeItem(SESSION_KEY)
      setToken('')
      setMe(null)
      setError(message(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) void loadAccount(token) }, [])

  function acceptToken(accessToken: string) {
    sessionStorage.setItem(SESSION_KEY, accessToken)
    setToken(accessToken)
    void loadAccount(accessToken)
  }

  async function signOut() {
    try { await logout(token) } finally {
      sessionStorage.removeItem(SESSION_KEY)
      setToken('')
      setMe(null)
      setHouseholds([])
    }
  }

  async function addHousehold(name: string) {
    const household = await createHousehold(token, name)
    setHouseholds((current) => [...current, household])
    setSelectedId(household.id)
    localStorage.setItem(HOUSEHOLD_KEY, household.id)
    setMe(await getMe(token))
  }

  if (!token || !me) return <AuthScreen busy={loading} initialError={error} onAuthenticated={acceptToken} />
  if (!households.length) return <HouseholdSetup user={me} onCreate={addHousehold} onSignOut={signOut} />

  const selected = households.find((household) => household.id === selectedId) ?? households[0]
  const membership = me.households.find((access) => access.household_id === selected.id)
  return <Dashboard household={selected} households={households} isOwner={membership?.relationship_type === 'owner'} onSelect={(id) => { setSelectedId(id); localStorage.setItem(HOUSEHOLD_KEY, id) }} onSignOut={signOut} token={token} user={me} />
}
