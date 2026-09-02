import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateImageField } from './CreateImageField'

vi.mock('./ImageCropDialog', () => ({
  ImageCropDialog: ({ file, onCancel, onConfirm }: { file: File | null; onCancel: () => void; onConfirm: (file: File) => void }) => file ? (
    <div role="dialog">
      <span>{file.name}</span>
      <button onClick={onCancel}>Cancel crop</button>
      <button onClick={() => onConfirm(new File(['cropped'], 'cropped.jpg', { type: 'image/jpeg' }))}>Use image</button>
    </div>
  ) : null,
}))

describe('CreateImageField', () => {
  it('uses the shared crop workflow before exposing a selected image', async () => {
    const onFileChange = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
    render(<CreateImageField label="Item image" onFileChange={onFileChange} />)

    await userEvent.upload(screen.getByLabelText(/Item image/), new File(['raw'], 'raw.jpg', { type: 'image/jpeg' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onFileChange).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Use image' }))
    expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'cropped.jpg' }))
    expect(screen.getByText('cropped.jpg')).toBeInTheDocument()
  })
})
