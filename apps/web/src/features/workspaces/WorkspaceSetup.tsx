import { enableNetworkStorage, getStorageStatus, migrateStorage, prepareStorage, type ApplianceStorageStatus, type MeResponse, type SystemStatus } from '@wherehouse/api-client'
import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

import { message } from '../../shared/utils/errors'

export function WorkspaceSetup({
  user,
  onCreate,
  onSignOut,
  system,
  token,
}: {
  user: MeResponse
  onCreate: (name: string) => Promise<void>
  onSignOut: () => Promise<void>
  system: SystemStatus | null
  token: string
}) {
  const storageSupported = Boolean(system?.capabilities?.storageManagement)
  const [step, setStep] = useState<'storage' | 'nas' | 'nas-credentials' | 'household'>(storageSupported ? 'storage' : 'household')
  const [storage, setStorage] = useState<ApplianceStorageStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driveConfirmation, setDriveConfirmation] = useState('')
  useEffect(() => { if (storageSupported) void getStorageStatus(token).then((value) => {
    setStorage(value)
    if (value.primary === 'external') setStep(value.nas.enabled ? 'household' : 'nas')
  }).catch((reason) => setError(message(reason))) }, [storageSupported, token])

  async function useDrive(deviceId: string) {
    setBusy(true); setError(null)
    try {
      const prepared = await prepareStorage(token, deviceId, driveConfirmation)
      if (!prepared.filesystemUuid) throw new Error('Prepared drive did not return a filesystem identity')
      await migrateStorage(token, prepared.filesystemUuid)
      setStorage(await getStorageStatus(token)); setStep('nas')
    } catch (reason) { setError(message(reason)) } finally { setBusy(false) }
  }

  async function enableNas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
    const password = String(data.get('password')); if (password !== String(data.get('confirmation'))) { setError('Passwords do not match.'); return }
    setBusy(true); setError(null)
    try { await enableNetworkStorage(token, String(data.get('username')), password); form.reset(); setStep('household') }
    catch (reason) { setError(message(reason)) } finally { setBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onCreate(String(new FormData(event.currentTarget).get('name')))
    } catch (reason) {
      setError(message(reason))
      setBusy(false)
    }
  }

  return (
    <main className="setup-layout">
      <nav className="simple-nav">
        <span className="wordmark dark"><img alt="WhereHouse" className="brand-logo" src="/logo.png" /></span>
        <Button className="text-button" onClick={() => void onSignOut()}>Sign out</Button>
      </nav>
      <section className="setup-card">
        {step === 'storage' ? <>
          <span className="step-number">01</span><p className="eyebrow">Primary Storage</p><h1>Choose where your data lives.</h1>
          <p className="muted">Internal SD storage works for normal WhereHouse use. A USB HDD or SSD provides more space and is required for Network Storage.</p>
          <Button onClick={() => { setStorage((current) => current ? { ...current, primary: 'internal' } : current); setStep('nas') }}>Use Internal SD</Button>
          {storage?.devices.filter((drive) => drive.selectable).map((drive) => <div className="setup-readiness" key={drive.id}><strong>{drive.model ?? 'USB drive'} · {(drive.capacityBytes / 1_000_000_000).toFixed(0)} GB</strong><span>Preparing this drive will erase every file on it.</span><Button disabled={busy || driveConfirmation !== 'ERASE AND USE THIS DRIVE'} onClick={() => void useDrive(drive.id)}>Use This Drive</Button></div>)}
          {storage?.devices.some((drive) => drive.selectable) ? <label>Type <strong>ERASE AND USE THIS DRIVE</strong> to confirm<input autoComplete="off" onChange={(event) => setDriveConfirmation(event.target.value)} value={driveConfirmation} /></label> : <p>No supported external USB drive is attached.</p>}
          {error ? <div className="alert">{error}</div> : null}
        </> : step === 'nas' ? <>
          <span className="step-number">02</span><p className="eyebrow">Network Storage</p><h1>Share ordinary files too?</h1>
          <p className="muted">Network Storage creates an authenticated Shared folder for Macs, PCs, phones, and other devices. WhereHouse application and database files remain private.</p>
          {storage?.primary === 'external' ? <Button className="primary-button" onClick={() => setStep('nas-credentials')}>Set up Network Storage</Button> : <p className="setup-readiness">Network Storage requires an external drive so shared files do not fill the SD card.</p>}
          <Button onClick={() => setStep('household')}>Skip for now</Button>
        </> : step === 'nas-credentials' ? <>
          <span className="step-number">03</span><p className="eyebrow">Set Up Network Storage</p><h1>Secure your Shared folder.</h1>
          <p className="muted">Your files will be available at smb://wherehouse.local/Shared. This credential is separate from your WhereHouse account.</p>
          <form onSubmit={(event) => void enableNas(event)}><label>Username<input autoComplete="username" name="username" pattern="[a-z][a-z0-9_-]{0,30}" required /></label><label>Password<input autoComplete="new-password" minLength={12} name="password" required type="password" /></label><label>Confirm password<input autoComplete="new-password" minLength={12} name="confirmation" required type="password" /></label>{error ? <div className="alert">{error}</div> : null}<Button className="primary-button" disabled={busy} type="submit">Enable Network Storage</Button><Button onClick={() => setStep('household')} type="button">Skip for now</Button></form>
        </> : <>
        <span className="step-number">{storageSupported ? '04' : '01'}</span>
        <p className="eyebrow">Hello, {user.user.display_name}</p>
        <h1>Name your household.</h1>
        <p className="muted">This is the home base for every area, container, item, and paired device.</p>
        {system ? (
          <div className="setup-readiness ready">
            <strong>Instance and storage ready</strong>
            <span>{system.storage.message} {system.storage.free_bytes === null ? '' : `${Math.floor(system.storage.free_bytes / 1_073_741_824)} GB free.`}</span>
            <span>Local address: http://{system.hostname}</span>
          </div>
        ) : null}
        <form onSubmit={submit}>
          <label>
            Household name
            <input autoFocus name="name" placeholder="The Billard household" required />
          </label>
          {error ? <div className="alert">{error}</div> : null}
          <Button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create household'}
          </Button>
        </form>
        </>}
      </section>
    </main>
  )
}
