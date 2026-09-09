import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

let started = false

export class EmptyNfcTagError extends Error {
  constructor() {
    super('This NFC tag does not contain a WhereHouse link.')
    this.name = 'EmptyNfcTagError'
  }
}

async function start() {
  if (!started) {
    await NfcManager.start()
    started = true
  }
  if (!(await NfcManager.isSupported())) throw new Error('NFC is not supported on this device.')
  if (!(await NfcManager.isEnabled())) throw new Error('NFC is turned off. Enable NFC and try again.')
}

export async function readNfcIdentifier(): Promise<string> {
  await start()
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'Hold your phone near a WhereHouse tag.' })
    const tag = await NfcManager.getTag()
    const message = tag?.ndefMessage ?? []
    if (!message.length) throw new EmptyNfcTagError()
    const record = message.find((entry) => Ndef.isType(entry, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI))
    if (!record) throw new Error('This NFC tag does not contain a WhereHouse link.')
    return Ndef.uri.decodePayload(Uint8Array.from(record.payload))
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined)
  }
}

export type NfcWriteResult = {
  previousPayload?: string
}

function uriPayload(message: Awaited<ReturnType<typeof NfcManager.ndefHandler.getNdefMessage>>): string | undefined {
  const record = message?.ndefMessage?.find((entry) => Ndef.isType(entry, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI))
  return record ? Ndef.uri.decodePayload(Uint8Array.from(record.payload)) : undefined
}

export async function writeNfcIdentifier(payload: string): Promise<NfcWriteResult> {
  await start()
  const message = Ndef.encodeMessage([Ndef.uriRecord(payload)])
  if (!message) throw new Error('Could not encode the NFC payload.')
  let previousPayload: string | undefined
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'Hold your phone near the NFC tag to write it.' })
    previousPayload = uriPayload(await NfcManager.ndefHandler.getNdefMessage())
    await NfcManager.ndefHandler.writeNdefMessage(message)
    await NfcManager.setAlertMessageIOS('Tag written. Remove it, then tap it again to verify.')
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined)
  }

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'Tap the NFC tag again to verify the new item link.' })
    const verified = await NfcManager.ndefHandler.getNdefMessage()
    if (uriPayload(verified) !== payload) {
      throw new Error('The NFC tag did not retain the new WhereHouse link. Try writing it again or use another tag.')
    }
    await NfcManager.setAlertMessageIOS('WhereHouse tag written and verified.')
    return { previousPayload }
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined)
  }
}
