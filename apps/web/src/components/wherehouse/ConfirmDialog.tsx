import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ConfirmDialog({
  busy = false,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  description,
  destructive = false,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  busy?: boolean
  cancelLabel?: string
  confirmLabel?: string
  description: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  open: boolean
  title: string
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onCancel() }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={busy} onClick={onCancel} variant="outline">{cancelLabel}</Button>
          <Button onClick={() => void onConfirm()} pending={busy} variant={destructive ? 'destructive' : 'default'}>
            {busy ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
