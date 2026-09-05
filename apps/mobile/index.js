import { registerRootComponent } from 'expo'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import './global.css'
import App from './App'

function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  )
}

registerRootComponent(Root)
