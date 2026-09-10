import { QrCode } from 'lucide-react-native'
import { useState } from 'react'

import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Text } from '../components/ui/text'

export function PairingScreen({ error, onChange, onPair, onScan, value }: { error: string | null; onChange: (value: string) => void; onPair: (password?: string, displayName?: string) => void; onScan: () => void; value: string }) {
  const canPair = Boolean(value.trim())
  const joining = value.trim().startsWith('wherehouse://join?')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  return (
    <Card className="mt-6 gap-2">
      <Text className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-ring">One-time setup</Text>
      <Text accessibilityRole="header" variant="heading">Pair this device</Text>
      <Text variant="muted">Scan the one-time QR code, or paste its WhereHouse pairing link below.</Text>
      <Input accessibilityLabel="WhereHouse pairing or invitation link" autoCapitalize="none" autoCorrect={false} className="mt-2" invalid={Boolean(error)} onChangeText={onChange} placeholder="wherehouse://pair?... or wherehouse://join?..." value={value} />
      {joining ? <><Text variant="muted">Sign in with the invited email. If this is a new account, enter your name too.</Text><Input accessibilityLabel="Display name for new account" onChangeText={setDisplayName} placeholder="Display name (new accounts)" value={displayName} /><Input accessibilityLabel="Password" autoCapitalize="none" onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} /></> : null}
      {error ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" variant="error">{error}</Text> : null}
      <Button accessibilityLabel="Scan pairing QR code" className="mt-2" onPress={onScan} variant="success">
        <QrCode color="#fff" size={18} strokeWidth={2.5} />
        <Text className="font-extrabold text-success-foreground">Scan QR code</Text>
      </Button>
      <Button accessibilityLabel={joining ? 'Enable self-service' : 'Pair device'} disabled={!canPair || (joining && password.length < 10)} onPress={() => onPair(password, displayName)}>
        <Text className="font-bold text-primary-foreground">{joining ? 'Enable self-service' : 'Pair device'}</Text>
      </Button>
    </Card>
  )
}
