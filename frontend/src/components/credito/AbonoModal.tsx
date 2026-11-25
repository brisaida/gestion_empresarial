import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { cxcApi, empresaApi } from '@/api/recursos'
import { printReciboAbono } from '@/lib/printCredito'
import CuentaSelect from '@/components/tarjetas/CuentaSelect'
import { formatCurrency, formatDate, getAxiosError, todayISO } from '@/lib/utils'
import type { AbonoVenta, MetodoAbono } from '@/types'

/**
 * Registrar un abono.
 * - Con `ventaId`: abono a esa factura.
 * - Con `clienteId` (sin venta): abono general, se reparte de la factura que vence primero a la más reciente.
 */
export interface AbonoDestino {
  ventaId?: number
  clienteId?: number
  titulo: string          // "Factura 000-001-01-00000123" o nombre del cliente
  saldo: number
  vence?: string | null
}

interface Props {
  destino: AbonoDestino | null
  empresaId: number
  onClose: () => void
  onSaved?: (abonos: AbonoVenta[]) => void
}

const METODOS: { value: MetodoAbono; label: string }[] = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'cheque',        label: 'Cheque' },
]

export default function AbonoModal({ destino, empresaId, onClose, onSaved }: Props) {
  return (
    <Modal open={!!destino} onClose={onClose} title="Registrar abono" size="md">
      {destino && (
        <AbonoForm key={destino.ventaId ? `v${destino.ventaId}` : `c${destino.clienteId}`}
          destino={destino} empresaId={empresaId} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  )
}

function AbonoForm({ destino, empresaId, onClose, onSaved }: Props & { destino: AbonoDestino }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [monto, setMonto]       = useState(destino.saldo.toFixed(2))
  const [fecha, setFecha]       = useState(todayISO())
  const [metodo, setMetodo]     = useState<MetodoAbono>('efectivo')
  const [referencia, setRef]    = useState('')
  const [observaciones, setObs] = useState('')
  const [imprimir, setImprimir] = useState(true)
  const [error, setError]       = useState('')
  const [cuentaId, setCuentaId] = useState('')

  const montoNum = Number(monto) || 0
  const restante = Math.max(0, destino.saldo - montoNum)

  const guardar = useMutation({
    mutationFn: async () => {
      const data = {
        monto: montoNum, fecha, metodo_pago: metodo, referencia: referencia.trim() || null, observaciones: observaciones.trim() || null,
        cuenta_bancaria_id: metodo !== 'efectivo' && cuentaId ? Number(cuentaId) : null,
      }
      if (destino.ventaId) return [(await cxcApi.abonar(destino.ventaId, data)).data.data]
      return (await cxcApi.abonarCliente(destino.clienteId!, data)).data.data
    },
    onSuccess: async (abonos) => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['cxc'] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['clientes-all'] })
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
      toast.success(`Abono de ${formatCurrency(montoNum)} registrado.`)
      onSaved?.(abonos)
      onClose()
      if (imprimir) {
        try {
          const [emp, logo] = await Promise.all([empresaApi.get(empresaId), empresaApi.logoBase64(empresaId)])
          printReciboAbono(abonos, emp.data.data, logo.data.data.logo_base64 ?? undefined, destino.clienteId ? restante : undefined)
        } catch { /* el recibo es opcional */ }
      }
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (montoNum <= 0) { setError('Escribe el monto del abono.'); return }
    if (montoNum > destino.saldo + 0.004) { setError(`El abono no puede pasar el saldo (${formatCurrency(destino.saldo)}).`); return }
    setError('')
    guardar.mutate()
  }

  const labelCls = 'block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5'

  return (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F4F7FA] border border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--cs)] truncate">{destino.titulo}</p>
              <p className="text-xs text-[#5F6B7A]">
                {destino.clienteId && !destino.ventaId ? 'Se aplica primero a la factura que vence antes' : destino.vence ? `Vence ${formatDate(destino.vence)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Saldo</p>
              <p className="text-lg font-bold text-[var(--cs)]">{formatCurrency(destino.saldo)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Monto (L) *" type="number" step="0.01" min="0.01" value={monto} autoFocus
                onChange={e => setMonto(e.target.value)} />
              <div className="flex gap-1 mt-1.5">
                <button type="button" onClick={() => setMonto(destino.saldo.toFixed(2))}
                  className="text-[11px] font-semibold text-[var(--cp)] hover:underline">Saldo completo</button>
              </div>
            </div>
            <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Forma de pago</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
              {METODOS.map(m => (
                <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                  className={`py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                    metodo === m.value ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={metodo === 'efectivo' ? 'Referencia (opcional)' : 'N° de referencia'} value={referencia}
              placeholder={metodo === 'cheque' ? 'N° de cheque' : metodo === 'transferencia' ? 'N° de transacción' : ''}
              onChange={e => setRef(e.target.value)} />
            <Input label="Observaciones" value={observaciones} onChange={e => setObs(e.target.value)} />
          </div>

          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-[#5F6B7A]">Saldo después del abono</span>
            <span className={`font-bold ${restante <= 0.004 ? 'text-emerald-600' : 'text-[var(--cs)]'}`}>
              {restante <= 0.004 ? 'Pagado' : formatCurrency(restante)}
            </span>
          </div>

          {metodo === 'efectivo' && (
            <p className="text-xs text-[#5F6B7A] -mt-2 px-1">Los abonos en efectivo se suman al efectivo esperado de la caja abierta.</p>
          )}
          {metodo !== 'efectivo' && (
            <CuentaSelect empresaId={empresaId} value={cuentaId} onChange={setCuentaId}
              uso={metodo === 'tarjeta' ? 'cuenta_tarjeta_id' : 'cuenta_transferencia_id'} label="Cuenta donde cae el abono" />
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
            <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
              <input type="checkbox" checked={imprimir} onChange={e => setImprimir(e.target.checked)} className="rounded accent-[var(--cp)]" />
              <Printer size={14} /> Imprimir recibo
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" loading={guardar.isPending}>Registrar abono</Button>
            </div>
          </div>
        </form>
  )
}
