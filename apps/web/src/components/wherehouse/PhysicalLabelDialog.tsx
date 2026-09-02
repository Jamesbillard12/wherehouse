import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function printPhysicalLabel({ code, name, qrCode }: { code: string; name: string; qrCode: string }) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.style.opacity = '0'
  document.body.append(frame)

  const printDocument = frame.contentDocument
  const printWindow = frame.contentWindow
  if (!printDocument || !printWindow) {
    frame.remove()
    return
  }

  printDocument.title = `${name} QR label`
  const style = printDocument.createElement('style')
  style.textContent = `
    @page { margin: 0.5in; }
    html, body { margin: 0; padding: 0; }
    body { color: #101828; font-family: Arial, sans-serif; print-color-adjust: exact; }
    .label { width: 3in; display: grid; justify-items: center; box-sizing: border-box; border: 2px solid #101828; padding: 0.15in; text-align: center; break-inside: avoid; }
    img { width: 2in; height: 2in; display: block; }
    strong { max-width: 100%; margin-top: 0.08in; overflow-wrap: anywhere; font-size: 18pt; line-height: 1.15; }
    span { max-width: 100%; margin-top: 0.05in; overflow-wrap: anywhere; color: #344054; font: 800 13pt/1 monospace; letter-spacing: 0.08em; }
  `
  printDocument.head.append(style)

  const label = printDocument.createElement('div')
  label.className = 'label'
  const image = printDocument.createElement('img')
  image.alt = `QR code for ${code}`
  const itemName = printDocument.createElement('strong')
  itemName.textContent = name
  const itemCode = printDocument.createElement('span')
  itemCode.textContent = code
  label.append(image, itemName, itemCode)
  printDocument.body.append(label)

  image.addEventListener('load', () => {
    const cleanup = () => frame.remove()
    printWindow.addEventListener('afterprint', cleanup, { once: true })
    printWindow.focus()
    printWindow.print()
    window.setTimeout(cleanup, 60_000)
  }, { once: true })
  image.src = qrCode
}

export function PhysicalLabelDialog({ code, error, name, onClose, qrCode }: { code: string; error?: string; name: string; onClose: () => void; qrCode: string }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="item-label-dialog gap-0 p-0 sm:max-w-[430px]">
        <DialogHeader className="label-dialog-heading">
          <DialogTitle>Print QR label</DialogTitle>
          <DialogDescription>Print and attach this label to {name}.</DialogDescription>
        </DialogHeader>
        <div className="item-label-print">
          {qrCode ? <img alt={`QR code for ${code}`} src={qrCode} /> : error ? <p className="form-error" role="alert">{error}</p> : <div aria-label="Generating QR code" className="label-qr-loading" role="status" />}
          <strong>{name}</strong>
          <span>{code}</span>
        </div>
        <DialogFooter className="label-actions">
          <DialogClose render={<Button size="lg" type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={!qrCode} onClick={() => printPhysicalLabel({ code, name, qrCode })} size="lg"><Printer aria-hidden="true" /> Print QR label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
