import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaDocumentos from './AbaDocumentos.jsx'

const uploadFn = vi.fn(async () => ({ error: null }))
const insertFn = vi.fn(async () => ({ error: null }))
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: (row) => { insertFn(row); return Promise.resolve({ error: null }) },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    storage: { from: () => ({
      upload: (path, file) => { uploadFn(path, file); return Promise.resolve({ error: null }) },
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: 'http://x/y' }, error: null }),
    }) },
  },
}))

describe('AbaDocumentos', () => {
  it('faz upload do arquivo e registra em documentos_caso', async () => {
    render(<AbaDocumentos caso={{ id: 'c1' }} />)
    const file = new File(['abc'], 'sentenca.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText(/arquivo/i), file)
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
    await waitFor(() => {
      expect(uploadFn).toHaveBeenCalled()
      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ caso_id: 'c1', nome: 'sentenca.pdf' }))
    })
  })
})
