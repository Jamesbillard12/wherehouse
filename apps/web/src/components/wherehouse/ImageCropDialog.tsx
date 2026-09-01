import { Crop, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const OUTPUT_SIZE = 1000

export function ImageCropDialog({ file, onCancel, onConfirm }: {
  file: File | null
  onCancel: () => void
  onConfirm: (file: File) => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const previewSize = previewRef.current?.clientWidth ?? 360
  const baseScale = imageSize.width && imageSize.height
    ? Math.max(previewSize / imageSize.width, previewSize / imageSize.height)
    : 1
  const renderedWidth = imageSize.width * baseScale * zoom
  const renderedHeight = imageSize.height * baseScale * zoom

  function clampPan(next: { x: number; y: number }, nextZoom = zoom) {
    const scale = baseScale * nextZoom
    const maxX = Math.max(0, (imageSize.width * scale - previewSize) / 2)
    const maxY = Math.max(0, (imageSize.height * scale - previewSize) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }

  function changeZoom(nextZoom: number) {
    setZoom(nextZoom)
    setPan((current) => clampPan(current, nextZoom))
  }

  async function cropImage() {
    if (!file || !imageSize.width || !previewRef.current) return
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const size = previewRef.current.clientWidth
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom
    const sourceSize = size / scale
    const sourceX = (image.naturalWidth - sourceSize) / 2 - pan.x / scale
    const sourceY = (image.naturalHeight - sourceSize) / 2 - pan.y / scale
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    canvas.getContext('2d')?.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to crop image.')), mimeType, 0.9))
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    onConfirm(new File([blob], `cropped-image.${extension}`, { type: mimeType }))
  }

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="image-crop-dialog sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle><Crop aria-hidden="true" /> Adjust image</DialogTitle>
          <DialogDescription>Drag the image to position it inside the square. Use the slider to zoom.</DialogDescription>
        </DialogHeader>
        <div
          className="image-crop-preview"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== event.pointerId) return
            const delta = { x: event.clientX - drag.x, y: event.clientY - drag.y }
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
            setPan((current) => clampPan({ x: current.x + delta.x, y: current.y + delta.y }))
          }}
          onPointerUp={() => { dragRef.current = null }}
          ref={previewRef}
        >
          {imageUrl ? <img alt="Crop preview" draggable={false} onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} src={imageUrl} style={{ height: renderedHeight, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`, width: renderedWidth }} /> : null}
          <span aria-hidden="true" className="image-crop-frame" />
        </div>
        <label className="image-crop-zoom"><Minus aria-hidden="true" /><span className="sr-only">Zoom</span><input aria-label="Zoom image" max="3" min="1" onChange={(event) => changeZoom(Number(event.target.value))} step="0.05" type="range" value={zoom} /><Plus aria-hidden="true" /></label>
        <DialogFooter className="mx-0 mb-0 rounded-b-lg">
          <Button onClick={onCancel} type="button" variant="outline">Cancel</Button>
          <Button disabled={!imageSize.width} onClick={() => void cropImage()} type="button">Use image</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
