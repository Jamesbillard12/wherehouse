import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>WhereHouse</Text>
        <Text style={styles.title}>Companion</Text>
        <Text style={styles.description}>
          Scan, add, move, transfer, and find your household inventory.
        </Text>
        <View style={styles.status}>
          <Text style={styles.statusText}>Mobile scaffold is running.</Text>
        </View>
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8f6',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  brand: {
    color: '#166534',
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    marginTop: 8,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    color: '#17211b',
  },
  description: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 27,
    color: '#536158',
  },
  status: {
    marginTop: 28,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#e8f5eb',
  },
  statusText: {
    color: '#166534',
    fontWeight: '600',
  },
})
