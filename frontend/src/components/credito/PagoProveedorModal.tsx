import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { cxpApi } from '@/api/recursos'
import { formatCurrency, formatDate, getAxiosError, todayISO } from '@/lib/utils'
import { METODO_COMPRA_LABEL } from '@/lib/metodosPago'
import { useAuth } from '@/stores/authStore'
import TarjetaSelect from '@/components/tarjetas/TarjetaSelect'
import CuentaSelect from '@/components/tarjetas/CuentaSelect'
import type { MetodoPagoCompra, PagoCompra } from '@/types'


/**
 * Pago a proveedor.
 * - Con `compraId`: pago a esa factura.
 * - Con `proveedorId` (sin compra): pago general, se aplica desde la factura que vence primero.
 */
export interface PagoDestino {
  compraId?: number
  proveedorId?: number
  titulo: string
  saldo: number
  vence?: string | null
}

interface Props {
  destino: PagoDestino | null
  onClose: () => void
  onSaved?: (pagos: PagoCompra[]) => void
}

const METODOS: MetodoPagoCompra[] = ['transferencia', 'efectivo', 'debito', 'cheque', 'tarjeta']

export default function PagoProveedorModal({ destino, onClose, onSaved }: Props) {
  return (
    <Modal open={!!destino} onClose={onClose} title="Registrar pago a proveedor" size="md">
      {destino && (
        <PagoForm key={destino.compraId ? `c${destino.compraId}` : `p${destino.proveedorId}`}
          destino={destino} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  )
}

function PagoForm({ destino, onClose, onSaved }: Props & { destino: PagoDestino }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [monto, setMonto]         = useState(destino.saldo.toFixed(2))
  const [fecha, setFecha]         = useState(todayISO())
  const [metodo, setMetodo]       = useState<MetodoPagoCompra>('transferencia')
  const [desdeCaja, setDesdeCaja] = useState(true)
  const [referencia, setRef]      = useState('')
  const [observaciones, setObs]   = useState('')
  const [error, setError]         = useState('')
  const [tarjetaId, setTarjetaId] = useState('')
  const [cuentaId, setCuentaId]   = useState('')
  const empresaId = useAuth().state.empresaActiva?.id ?? 0

  const montoNum = Number(monto) || 0
  const restante = Math.max(0, destino.saldo - montoNum)

  const guardar = useMutation({
    mutationFn: async () => {
      const data = {
        monto: montoNum, fecha, metodo_pago: metodo,
        desde_caja: metodo === 'efectivo' && desdeCaja,
        tarjeta_credito_id: metodo === 'tarjeta' && tarjetaId ? Number(tarjetaId) : null,
        cuenta_bancaria_id: ['debito', 'transferencia', 'cheque'].includes(metodo) && cuentaId ? Number(cuentaId) : null,
        referencia: referencia.trim() || null, observaciones: observaciones.trim() || null,
      }
      if (destino.compraId) return [(await cxpApi.pagar(destino.compraId, data)).data.data]
      return (await cxpApi.pagarProveedor(destino.proveedorId!, data)).data.data
    },
    onSuccess: (pagos) => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['cxp'] })
      qc.invalidateQueries({ queryKey: ['proveedores'] })
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['tarjetas'] })
      qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
      toast.success(`Pago de ${formatCurrency(montoNum)} registrado.`)
      onSaved?.(pagos)
      onClose()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (montoNum <= 0) { setError('Escribe el monto del pago.'); return }
    if (metodo === 'tarjeta' && !tarjetaId) { setError('Selecciona con qué tarjeta de crédito se paga.'); return }
    if (montoNum > destino.saldo + 0.004) { setError(`El pago no puede pasar el saldo (${formatCurrency(destino.saldo)}).`); return }
    setError('')
    guardar.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F4F7FA] border border-gray-100">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cs)] truncate">{destino.titulo}</p>
          <p className="text-xs text-[#5F6B7A]">
            {destino.proveedorId && !destino.compraId ? 'Se aplica primero a la factura que vence antes' : destino.vence ? `Vence ${formatDate(destino.vence)}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Saldo</p>
          <p className="text-lg font-bold text-[var(--cs)]">{formatCurrency(destino.saldo)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input label="Monto (L) *" type="number" step="0.01" min="0.01" value={monto} autoFocus onChange={e => setMonto(e.target.value)} />
          <button type="button" onClick={() => setMonto(destino.saldo.toFixed(2))}
            className="text-[11px] font-semibold text-[var(--cp)] hover:underline mt-1.5">Saldo completo</button>
        </div>
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Forma de pago</label>
        <div className="flex flex-wrap gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
          {METODOS.map(m => (
            <button key={m} type="button" onClick={() => setMetodo(m)}
              className={`flex-1 min-w-[90px] py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                metodo === m ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]'}`}>
              {METODO_COMPRA_LABEL[m]}
            </button>
          ))}
        </div>
        {metodo === 'efectivo' && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
            <input type="checkbox" checked={desdeCaja} onChange={e => setDesdeCaja(e.target.checked)} className="rounded accent-[var(--cp)]" />
            Sale del efectivo de la caja (se resta en el cierre)
          </label>
        )}
        {metodo === 'tarjeta' && <TarjetaSelect empresaId={empresaId} value={tarjetaId} onChange={setTarjetaId} className="mt-3" />}
        {['debito', 'transferencia', 'cheque'].includes(metodo) && (
          <CuentaSelect empresaId={empresaId} value={cuentaId} onChange={setCuentaId} uso="cuenta_pagos_id" label="Cuenta de donde sale el pago" className="mt-3" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="N° comprobante / referencia" value={referencia}
          placeholder={metodo === 'cheque' ? 'N° de cheque' : metodo === 'transferencia' ? 'N° de transacción' : ''}
          onChange={e => setRef(e.target.value)} />
        <Input label="Observaciones" value={observaciones} onChange={e => setObs(e.target.value)} />
      </div>

      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-[#5F6B7A]">Saldo después del pago</span>
        <span className={`font-bold ${restante <= 0.004 ? 'text-emerald-600' : 'text-[var(--cs)]'}`}>
          {restante <= 0.004 ? 'Pagado' : formatCurrency(restante)}
        </span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={guardar.isPending}>Registrar pago</Button>
      </div>
    </form>
  )
}
