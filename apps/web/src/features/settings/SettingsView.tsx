import { createPairingSession, listDevices, revokeDevice, type Device, type Household, type MeResponse, type PairingSession } from '@wherehouse/api-client'
import { CircleUserRound, Database, House, Info, Laptop, Palette, Shield, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

import { ConfirmDialog } from '../../components/wherehouse/ConfirmDialog'
import { PageHeader } from '../../components/wherehouse/PageHeader'
import { formatDate } from '../../shared/utils/date'
import { message } from '../../shared/utils/errors'
import type { SettingsSection } from '../../shared/utils/navigation'

const sections: { id: SettingsSection; label: string; icon: typeof House }[] = [
  { id: 'account', label: 'Account', icon: CircleUserRound },
  { id: 'households', label: 'Households', icon: House },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'privacy', label: 'Data & Privacy', icon: Shield },
  { id: 'about', label: 'About', icon: Info },
]

export function SettingsView({ household, households, isOwner, onCreateHousehold, onNavigate, onSelect, section, token, user }: {
  household: Household; households: Household[]; isOwner: boolean
  onCreateHousehold: (name: string) => Promise<void>
  onNavigate: (section: SettingsSection) => void; onSelect: (id: string) => void
  section: SettingsSection; token: string; user: MeResponse
}) {
  return <div className="settings-page"><PageHeader eyebrow="WhereHouse" title="Settings" /><div className="settings-layout"><nav aria-label="Settings sections" className="settings-nav">{sections.map(({ id, label, icon: Icon }) => <a className={section === id ? 'active' : ''} href={`/settings/${id}`} key={id} onClick={(event) => { event.preventDefault(); onNavigate(id) }}><Icon aria-hidden="true" />{label}</a>)}</nav><section className="settings-content">{section === 'account' ? <Account user={user} /> : section === 'households' ? <Households household={household} households={households} isOwner={isOwner} onCreate={onCreateHousehold} onSelect={onSelect} token={token} user={user} /> : section === 'preferences' ? <Preferences /> : section === 'privacy' ? <Privacy /> : <About />}</section></div></div>
}

function Account({ user }: { user: MeResponse }) {
  return <><p className="eyebrow">User scoped</p><h2>Account</h2><div className="settings-card"><label>Display name<input disabled value={user.user.display_name} /></label><label>Email address<input disabled value={user.user.email} /></label><p className="muted">Profile and password changes are not yet supported by the account API.</p></div></>
}

function Households({ household, households, isOwner, onCreate, onSelect, token, user }: { household: Household; households: Household[]; isOwner: boolean; onCreate: (name: string) => Promise<void>; onSelect: (id: string) => void; token: string; user: MeResponse }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [pairing, setPairing] = useState<PairingSession | null>(null)
  const [pairingDeviceBaseline, setPairingDeviceBaseline] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null)
  const [revoking, setRevoking] = useState(false)
  useEffect(() => { setPairing(null); setQrCode(''); if (isOwner) void listDevices(token, household.id).then(setDevices).catch((reason) => setError(message(reason))); else setDevices([]) }, [household.id, isOwner, token])
  useEffect(() => { if (pairing) void QRCode.toDataURL(pairing.pairing_uri, { margin: 1, width: 260 }).then(setQrCode) }, [pairing])
  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    async function refreshDevices() {
      const next = await listDevices(token, household.id)
      if (cancelled) return
      setDevices(next)
      if (pairing && next.filter((device) => device.is_active).length > pairingDeviceBaseline) {
        setPairing(null)
        setQrCode('')
      }
    }
    const interval = window.setInterval(() => void refreshDevices().catch((reason) => !cancelled && setError(message(reason))), 2_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [household.id, isOwner, pairing?.id, pairingDeviceBaseline, token])
  async function pair() { try { const current = await listDevices(token, household.id); setDevices(current); setPairingDeviceBaseline(current.filter((device) => device.is_active).length); setPairing(await createPairingSession(token, household.id, { instance_name: `${household.name} WhereHouse`, instance_type: location.hostname === 'localhost' ? 'local' : 'cloud' })) } catch (reason) { setError(message(reason)) } }
  async function revoke() { if (!deviceToRevoke) return; setRevoking(true); try { await revokeDevice(token, deviceToRevoke.id); setDevices(await listDevices(token, household.id)); setDeviceToRevoke(null) } catch (reason) { setError(message(reason)) } finally { setRevoking(false) } }
  async function create(event: React.FormEvent) { event.preventDefault(); if (!newHouseholdName.trim()) return; setCreating(true); setError(null); try { await onCreate(newHouseholdName.trim()); setNewHouseholdName('') } catch (reason) { setError(message(reason)) } finally { setCreating(false) } }
  const role = user.households.find((entry) => entry.household_id === household.id)?.relationship_type
  return <>
    <p className="eyebrow">Household scoped</p>
    <h2>Households</h2>
    <form className="settings-card add-household-form" onSubmit={(event) => void create(event)}>
      <h3>Add Household</h3>
      <p className="muted">Create another independent inventory context. You will become its owner.</p>
      <label>Household name<input disabled={creating} onChange={(event) => setNewHouseholdName(event.target.value)} placeholder="Workshop, cabin, storage unit…" required value={newHouseholdName} /></label>
      <Button className="primary-button compact" disabled={creating || !newHouseholdName.trim()} type="submit">{creating ? 'Creating…' : 'Add household'}</Button>
    </form>
    <div className="household-list">{households.map((entry) => <Button className={entry.id === household.id ? 'active' : ''} key={entry.id} onClick={() => onSelect(entry.id)}><House aria-hidden="true" /><span><strong>{entry.name}</strong><small>{user.households.find((access) => access.household_id === entry.id)?.relationship_type ?? 'member'}{entry.id === household.id ? ' · Active' : ''}</small></span></Button>)}</div>
    <div className="settings-card" id="connected-devices"><h3>{household.name}</h3><p className="muted">Your relationship: {role}</p><h3>Connected Devices</h3>{isOwner ? <><Button className="primary-button compact" onClick={() => void pair()}>Pair a device</Button>{pairing && qrCode ? <div className="settings-pairing"><img alt="One-time device pairing QR code" src={qrCode} /><span>Expires {formatDate(pairing.expires_at)}</span></div> : null}<div className="device-list">{devices.map((device) => <article key={device.id}><div className="device-icon">{device.device_type === 'phone' ? <Smartphone /> : <Laptop />}</div><div><strong>{device.name}</strong><span>{device.device_type} · {device.is_active ? `Active · Last seen ${formatDate(device.last_seen_at)}` : `Revoked ${formatDate(device.revoked_at)}`}</span></div>{device.is_active ? <Button className="danger-button" onClick={() => setDeviceToRevoke(device)}>Revoke</Button> : null}</article>)}</div>{devices.length ? null : <p className="muted">No paired devices yet. Pair a phone to use the mobile companion.</p>}</> : <p className="notice">Only household owners can manage connected devices and members.</p>}{error ? <div className="alert">{error}</div> : null}</div>
    <ConfirmDialog busy={revoking} confirmLabel="Revoke device" description={`${deviceToRevoke?.name ?? 'This device'} will disconnect immediately and must be paired again before it can sync.`} destructive onCancel={() => setDeviceToRevoke(null)} onConfirm={revoke} open={Boolean(deviceToRevoke)} title="Revoke device?" />
  </>
}

function Preferences() { return <><p className="eyebrow">Local preference</p><h2>Preferences</h2><div className="settings-card"><h3>Appearance</h3><p className="muted">WhereHouse follows your system appearance. Explicit theme selection will be added when theming is supported end to end.</p></div></> }
function Privacy() { return <><p className="eyebrow">Device and household data</p><h2>Data & Privacy</h2><div className="settings-card"><Database aria-hidden="true" /><h3>Local-first inventory</h3><p className="muted">Household inventory remains authoritative on your WhereHouse instance. This browser stores only session and active-household preferences.</p></div></> }
function About() { return <><p className="eyebrow">Application</p><h2>About</h2><div className="settings-card about-card"><img alt="WhereHouse" src="/logo.png" /><h3>WhereHouse</h3><p className="muted">Local-first household inventory and spatial organization.</p><small>Web version {__APP_VERSION__}</small></div></> }
