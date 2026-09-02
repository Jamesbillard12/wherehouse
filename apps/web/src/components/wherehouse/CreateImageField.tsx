import { Camera, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function CreateImageField({ label = 'Image' }: { label?: string }) {
  const [selection, setSelection] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.url)
  }, [selection])

  return (
    <label className="create-image-field">
      <span>{label} <span className="optional">Optional</span></span>
      <span className="create-image-picker">
        {selection ? <img alt="Selected upload preview" src={selection.url} /> : <span className="create-image-placeholder"><ImageIcon aria-hidden="true" /></span>}
        <span className="create-image-copy"><strong>{selection ? selection.name : 'Add a photo'}</strong><small>JPEG, PNG, or WebP up to 8 MB</small></span>
        <span className="create-image-button"><Camera aria-hidden="true" /> {selection ? 'Change' : 'Choose image'}</span>
        <input accept="image/jpeg,image/png,image/webp" name="image" onChange={(event) => { const file = event.target.files?.[0]; setSelection(file ? { name: file.name, url: URL.createObjectURL(file) } : null) }} tabIndex={-1} type="file" />
      </span>
    </label>
  )
}
