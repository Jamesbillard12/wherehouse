import { QrCode } from 'lucide-react-native'

import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Text } from '../components/ui/text'

export function PairingScreen({ error, onChange, onPair, onScan, value }: { error: string | null; onChange: (value: string) => void; onPair: () => void; onScan: () => void; value: string }) {
  const canPair = Boolean(value.trim())
  return (
    <Card className="mt-6 gap-2">
      <Text className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-ring">One-time setup</Text>
      <Text accessibilityRole="header" variant="heading">Pair this device</Text>
      <Text variant="muted">Scan the one-time QR code, or paste its WhereHouse pairing link below.</Text>
      <Input accessibilityLabel="WhereHouse pairing link" autoCapitalize="none" autoCorrect={false} className="mt-2" invalid={Boolean(error)} onChangeText={onChange} onSubmitEditing={canPair ? onPair : undefined} placeholder="wherehouse://pair?..." returnKeyType="go" value={value} />
      {error ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" variant="error">{error}</Text> : null}
      <Button accessibilityLabel="Scan pairing QR code" className="mt-2" onPress={onScan} variant="success">
        <QrCode color="#fff" size={18} strokeWidth={2.5} />
        <Text className="font-extrabold text-success-foreground">Scan QR code</Text>
      </Button>
      <Button accessibilityLabel="Pair device" disabled={!canPair} onPress={onPair}>
        <Text className="font-bold text-primary-foreground">Pair device</Text>
      </Button>
    </Card>
  )
}
