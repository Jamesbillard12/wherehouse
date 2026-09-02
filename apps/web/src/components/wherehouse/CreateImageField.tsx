import { Camera, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ImageCropDialog } from './ImageCropDialog'

export function CreateImageField({ label = 'Image', onFileChange }: { label?: string; onFileChange: (file: File | null) => void }) {
  const [selection, setSelection] = useState<{ name: string; url: string } | null>(null)
  const [imageToCrop, setImageToCrop] = useState<File | null>(null)

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.url)
  }, [selection])

  function confirmImage(file: File) {
    setSelection({ name: file.name, url: URL.createObjectURL(file) })
    setImageToCrop(null)
    onFileChange(file)
  }

  return <>
    <label className="create-image-field">
      <span>{label} <span className="optional">Optional</span></span>
      <span className="create-image-picker">
        {selection ? <img alt="Selected upload preview" src={selection.url} /> : <span className="create-image-placeholder"><ImageIcon aria-hidden="true" /></span>}
        <span className="create-image-copy"><strong>{selection ? selection.name : 'Add a photo'}</strong><small>JPEG, PNG, or WebP up to 8 MB</small></span>
        <span className="create-image-button"><Camera aria-hidden="true" /> {selection ? 'Change' : 'Choose image'}</span>
        <input accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImageToCrop(event.target.files?.[0] ?? null); event.target.value = '' }} tabIndex={-1} type="file" />
      </span>
    </label>
    <ImageCropDialog file={imageToCrop} onCancel={() => setImageToCrop(null)} onConfirm={confirmImage} />
  </>
}
