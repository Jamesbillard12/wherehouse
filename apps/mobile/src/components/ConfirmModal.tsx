import { Modal, Pressable, Text, View } from 'react-native'

import { styles } from '../theme/styles'

export function ConfirmModal({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  description,
  destructive = false,
  onCancel,
  onConfirm,
  title,
  visible,
}: {
  cancelLabel?: string
  confirmLabel?: string
  description: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  visible: boolean
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.confirmBackdrop}>
        <Pressable accessibilityLabel="Close confirmation" onPress={onCancel} style={styles.confirmDismiss} />
        <View style={styles.confirmCard}>
          <Text accessibilityRole="header" style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmDescription}>{description}</Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>{cancelLabel}</Text></Pressable>
            <Pressable onPress={onConfirm} style={[styles.confirmAction, destructive && styles.confirmActionDestructive]}><Text style={styles.confirmActionText}>{confirmLabel}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
