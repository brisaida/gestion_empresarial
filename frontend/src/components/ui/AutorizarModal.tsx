import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { getAxiosError } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  /** Ej. "requisición REQ-0004" */
  documento: string
  onAutorizar: (pin: string) => Promise<unknown>
}

/**
 * Confirma la autorización de un documento con el PIN personal del usuario.
 * Al autorizar, el documento queda con la firma y el sello de la empresa.
 */
export default function AutorizarModal({ open, onClose, documento, onAutorizar }: Props) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) { setPin(''); setError('') } }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await onAutorizar(pin)
      onClose()
    } catch (err) {
      setError(getAxiosError(err)); setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Autorizar documento" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 items-start p-3 rounded-lg bg-[var(--cp)]/5 border border-[var(--cp)]/15">
          <ShieldCheck size={18} className="text-[var(--cp)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--cs)]">
            Vas a autorizar la <strong>{documento}</strong>. Se agregarán la firma y el sello de la empresa y
            ya no se podrá editar.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Tu PIN</label>
          <input type="password" inputMode="numeric" autoComplete="off" autoFocus
            value={pin} maxLength={6}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-center text-xl tracking-[0.5em] font-bold text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={pin.length < 4} icon={<ShieldCheck size={15} />}>
            Autorizar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
