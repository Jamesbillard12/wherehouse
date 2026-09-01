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

export async function writeNfcIdentifier(payload: string): Promise<void> {
  await start()
  const message = Ndef.encodeMessage([Ndef.uriRecord(payload)])
  if (!message) throw new Error('Could not encode the NFC payload.')
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'Hold your phone near the NFC tag to write it.' })
    await NfcManager.ndefHandler.writeNdefMessage(message)
    const verified = await NfcManager.ndefHandler.getNdefMessage()
    const record = verified?.ndefMessage?.find((entry) => Ndef.isType(entry, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI))
    if (!record || Ndef.uri.decodePayload(Uint8Array.from(record.payload)) !== payload) throw new Error('The tag was written but could not be verified.')
    await NfcManager.setAlertMessageIOS('WhereHouse tag written and verified.')
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined)
  }
}
