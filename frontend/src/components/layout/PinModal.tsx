import { useState, useEffect } from 'react'
import { KeyRound } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { authApi } from '@/api/auth'
import { useAuth } from '@/stores/authStore'
import { getAxiosError } from '@/lib/utils'

const pinCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-center text-lg tracking-[0.4em] font-bold text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]"
const labelCls = "block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5"

/** Crear o cambiar el PIN personal con el que se autorizan documentos. */
export default function PinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setUsuario } = useAuth()
  const tienePin = state.usuario?.tiene_pin ?? false

  const [password, setPassword] = useState('')
  const [pin, setPin]           = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [ok, setOk]             = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (open) { setPassword(''); setPin(''); setConfirm(''); setError(''); setOk(false) }
  }, [open])

  const soloDigitos = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (pin !== confirm) { setError('Los PIN no coinciden.'); return }
    setLoading(true)
    try {
      const res = await authApi.guardarPin(password, pin, confirm)
      setUsuario(res.data.data)
      setOk(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(getAxiosError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tienePin ? 'Cambiar PIN de autorización' : 'Crear PIN de autorización'} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-[#5F6B7A]">
          Con este PIN autorizas requisiciones y cotizaciones con la firma y el sello de la empresa. Es personal: no lo compartas.
        </p>

        <div>
          <label className={labelCls}>Tu contraseña</label>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tienePin ? 'Nuevo PIN' : 'PIN'}</label>
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(soloDigitos(e.target.value))} className={pinCls} />
          </div>
          <div>
            <label className={labelCls}>Confirmar</label>
            <input type="password" inputMode="numeric" autoComplete="off" value={confirm} onChange={e => setConfirm(soloDigitos(e.target.value))} className={pinCls} />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">De 4 a 6 dígitos.</p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
        {ok    && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">PIN guardado.</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={!password || pin.length < 4 || confirm.length < 4} icon={<KeyRound size={15} />}>
            Guardar PIN
          </Button>
        </div>
      </form>
    </Modal>
  )
}
