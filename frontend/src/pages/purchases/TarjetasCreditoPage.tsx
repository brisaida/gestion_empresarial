import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, Pencil, Banknote, ListOrdered, ReceiptText, Ban, Loader2, CalendarClock } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { tarjetasApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, getAxiosError, todayISO, cn } from '@/lib/utils'
import CuentaSelect from '@/components/tarjetas/CuentaSelect'
import type { TarjetaCredito } from '@/types'

const ORIGEN: Record<string, string> = {
  requisicion: 'Requisición', compra: 'Compra', pago_proveedor: 'Pago a proveedor', devolucion: 'Devolución', manual: 'Manual',
}

export default function TarjetasCreditoPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const [todas, setTodas]       = useState(false)
  const [editar, setEditar]     = useState<TarjetaCredito | 'nueva' | null>(null)
  const [pagar, setPagar]       = useState<TarjetaCredito | null>(null)
  const [cargo, setCargo]       = useState<TarjetaCredito | null>(null)
  const [movs, setMovs]         = useState<TarjetaCredito | null>(null)

  const { data: tarjetas = [], isLoading } = useQuery({
    queryKey: ['tarjetas', empresaId, 'pantalla', todas],
    queryFn:  () => tarjetasApi.list(empresaId, todas).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const total = tarjetas.filter(t => t.activo).reduce((s, t) => s + t.saldo, 0)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--cs)]">Tarjetas de crédito</h1>
          <p className="text-sm text-[#5F6B7A]">Lo cargado a cada tarjeta desde requisiciones, compras y pagos a proveedores, y los pagos al banco.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
            <input type="checkbox" checked={todas} onChange={e => setTodas(e.target.checked)} className="rounded accent-[var(--cp)]" />
            Ver desactivadas
          </label>
          <Button icon={<Plus size={15} />} onClick={() => setEditar('nueva')}>Nueva tarjeta</Button>
        </div>
      </div>

      {tarjetas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#5F6B7A]">Total que se debe en tarjetas</span>
          <span className="text-2xl font-bold text-[var(--cs)]">{formatCurrency(total)}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-14"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
      ) : tarjetas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-14 text-center">
          <CreditCard size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-[#5F6B7A]">No hay tarjetas registradas.</p>
          <Button className="mt-4" icon={<Plus size={15} />} onClick={() => setEditar('nueva')}>Agregar la primera</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tarjetas.map(t => {
            const uso = t.limite ? Math.min(100, Math.max(0, (t.saldo / t.limite) * 100)) : null
            return (
              <div key={t.id} className={cn('bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4', !t.activo && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--cs) 0%, var(--cp) 100%)' }}>
                      <CreditCard size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--cs)] truncate">{t.banco} · {t.nombre}</p>
                      <p className="text-sm font-mono text-[#5F6B7A]">•••• {t.ultimos4}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!t.activo && <Badge variant="gray">Desactivada</Badge>}
                    <button onClick={() => setEditar(t)} title="Editar tarjeta" className="p-1.5 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100"><Pencil size={14} /></button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Se debe</p>
                  <p className={cn('text-2xl font-bold', t.saldo > 0 ? 'text-[var(--cs)]' : 'text-emerald-600')}>{formatCurrency(t.saldo)}</p>
                  {uso !== null && (
                    <>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className={cn('h-full rounded-full', uso > 90 ? 'bg-red-500' : uso > 70 ? 'bg-amber-500' : 'bg-[var(--cp)]')} style={{ width: `${uso}%` }} />
                      </div>
                      <p className="text-xs text-[#5F6B7A] mt-1">
                        Límite {formatCurrency(t.limite!)} · disponible <strong className={(t.disponible ?? 0) < 0 ? 'text-red-600' : ''}>{formatCurrency(t.disponible ?? 0)}</strong>
                      </p>
                    </>
                  )}
                </div>

                {t.dia_corte && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="px-3 py-2 rounded-lg bg-[#F4F7FA]">
                      <p className="text-[#5F6B7A]">Cargado desde el corte</p>
                      <p className="font-bold text-[var(--cs)]">{formatCurrency(t.cargado_periodo ?? 0)}</p>
                      <p className="text-[10px] text-[#5F6B7A]">Corte {formatDate(t.ultimo_corte)} · próximo {formatDate(t.proximo_corte)}</p>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[#F4F7FA]">
                      <p className="text-[#5F6B7A] flex items-center gap-1"><CalendarClock size={11} /> Fecha de pago</p>
                      <p className="font-bold text-[var(--cs)]">{t.fecha_pago ? formatDate(t.fecha_pago) : '—'}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-auto">
                  <Button size="sm" variant="secondary" icon={<ListOrdered size={14} />} onClick={() => setMovs(t)}>Movimientos</Button>
                  <Button size="sm" icon={<Banknote size={14} />} onClick={() => setPagar(t)} disabled={!t.activo}>Pagar al banco</Button>
                  <Button size="sm" variant="secondary" icon={<ReceiptText size={14} />} onClick={() => setCargo(t)} disabled={!t.activo}>Otro cargo</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!editar} onClose={() => setEditar(null)} title={editar === 'nueva' ? 'Nueva tarjeta de crédito' : 'Editar tarjeta'} size="md">
        {editar && <FormTarjeta key={editar === 'nueva' ? 'n' : editar.id} tarjeta={editar === 'nueva' ? null : editar} empresaId={empresaId} onClose={() => setEditar(null)} />}
      </Modal>
      <Modal open={!!pagar} onClose={() => setPagar(null)} title="Pago de tarjeta al banco" size="md">
        {pagar && <FormPago key={pagar.id} tarjeta={pagar} onClose={() => setPagar(null)} />}
      </Modal>
      <Modal open={!!cargo} onClose={() => setCargo(null)} title="Otro cargo a la tarjeta" size="sm">
        {cargo && <FormCargo key={cargo.id} tarjeta={cargo} onClose={() => setCargo(null)} />}
      </Modal>
      <Modal open={!!movs} onClose={() => setMovs(null)} title={movs ? `Movimientos · ${movs.etiqueta}` : ''} size="xl">
        {movs && <Movimientos key={movs.id} tarjeta={movs} />}
      </Modal>
    </div>
  )
}

function useRefrescar() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['tarjetas'] })
    qc.invalidateQueries({ queryKey: ['tarjeta-movs'] })
    qc.invalidateQueries({ queryKey: ['caja-actual'] })
    qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
  }
}

function FormTarjeta({ tarjeta, empresaId, onClose }: { tarjeta: TarjetaCredito | null; empresaId: number; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [f, setF] = useState({
    nombre: tarjeta?.nombre ?? '', banco: tarjeta?.banco ?? '', ultimos4: tarjeta?.ultimos4 ?? '',
    dia_corte: tarjeta?.dia_corte ? String(tarjeta.dia_corte) : '', dia_pago: tarjeta?.dia_pago ? String(tarjeta.dia_pago) : '',
    limite: tarjeta?.limite != null ? String(tarjeta.limite) : '', activo: tarjeta?.activo ?? true,
  })
  const [error, setError] = useState('')

  const guardar = useMutation({
    mutationFn: () => {
      const data = {
        empresa_id: empresaId, nombre: f.nombre.trim(), banco: f.banco.trim(), ultimos4: f.ultimos4.trim(), activo: f.activo,
        dia_corte: f.dia_corte ? Number(f.dia_corte) : null, dia_pago: f.dia_pago ? Number(f.dia_pago) : null,
        limite: f.limite ? Number(f.limite) : null,
      }
      return tarjeta ? tarjetasApi.update(tarjeta.id, data) : tarjetasApi.create(data)
    },
    onSuccess: () => { refrescar(); toast.success(tarjeta ? 'Tarjeta actualizada.' : 'Tarjeta agregada.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Banco *" value={f.banco} placeholder="BAC, Ficohsa, Atlántida…" onChange={e => setF({ ...f, banco: e.target.value })} />
        <Input label="Nombre de la tarjeta *" value={f.nombre} placeholder="Visa Empresarial" onChange={e => setF({ ...f, nombre: e.target.value })} />
        <Input label="Últimos 4 dígitos *" value={f.ultimos4} maxLength={4} inputMode="numeric" placeholder="4521"
          onChange={e => setF({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
        <Input label="Límite de crédito (L)" type="number" min="0" step="0.01" value={f.limite} placeholder="Opcional" onChange={e => setF({ ...f, limite: e.target.value })} />
        <Input label="Día de corte" type="number" min="1" max="31" value={f.dia_corte} placeholder="Ej. 15" onChange={e => setF({ ...f, dia_corte: e.target.value })} />
        <Input label="Día de pago" type="number" min="1" max="31" value={f.dia_pago} placeholder="Ej. 5" onChange={e => setF({ ...f, dia_pago: e.target.value })} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
        <input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} className="rounded accent-[var(--cp)]" />
        Activa (aparece al elegir tarjeta en requisiciones y compras)
      </label>
      <p className="text-[11px] text-[#5F6B7A]">Solo se guardan los últimos 4 dígitos, nunca el número completo.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={guardar.isPending}>Guardar</Button>
      </div>
    </form>
  )
}

function FormPago({ tarjeta, onClose }: { tarjeta: TarjetaCredito; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [monto, setMonto]   = useState(tarjeta.saldo > 0 ? tarjeta.saldo.toFixed(2) : '')
  const [fecha, setFecha]   = useState(todayISO())
  const [metodo, setMetodo] = useState<'transferencia' | 'efectivo' | 'debito' | 'cheque'>('transferencia')
  const [caja, setCaja]     = useState(false)
  const [ref, setRef]       = useState('')
  const [obs, setObs]       = useState('')
  const [error, setError]   = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const empresaId = useAuth().state.empresaActiva?.id ?? 0

  const guardar = useMutation({
    mutationFn: () => tarjetasApi.pagar(tarjeta.id, {
      cuenta_bancaria_id: metodo !== 'efectivo' && cuentaId ? Number(cuentaId) : null,
      monto: Number(monto), fecha, metodo_pago: metodo, desde_caja: metodo === 'efectivo' && caja,
      referencia: ref.trim() || null, observaciones: obs.trim() || null,
    }),
    onSuccess: () => { refrescar(); toast.success(`Pago de ${formatCurrency(Number(monto))} registrado.`); onClose() },
    onError: err => setError(getAxiosError(err)),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); if (!(Number(monto) > 0)) { setError('Escribe el monto.'); return } guardar.mutate() }} className="space-y-4">
      <div className="flex justify-between px-4 py-3 rounded-xl bg-[#F4F7FA] text-sm">
        <span className="font-semibold text-[var(--cs)]">{tarjeta.etiqueta}</span>
        <span>Se debe <strong>{formatCurrency(tarjeta.saldo)}</strong></span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Monto pagado (L) *" type="number" step="0.01" min="0.01" value={monto} autoFocus onChange={e => setMonto(e.target.value)} />
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Cómo se pagó</label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
          {([['transferencia', 'Transferencia'], ['debito', 'Débito'], ['cheque', 'Cheque'], ['efectivo', 'Efectivo']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMetodo(k)}
              className={cn('py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all', metodo === k ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A]')}>
              {l}
            </button>
          ))}
        </div>
        {metodo === 'efectivo' && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
            <input type="checkbox" checked={caja} onChange={e => setCaja(e.target.checked)} className="rounded accent-[var(--cp)]" />
            Sale del efectivo de la caja (se resta en el cierre)
          </label>
        )}
        {metodo !== 'efectivo' && (
          <CuentaSelect empresaId={empresaId} value={cuentaId} onChange={setCuentaId} uso="cuenta_pagos_id" label="Cuenta de donde sale el pago" className="mt-3" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="N° de referencia" value={ref} onChange={e => setRef(e.target.value)} />
        <Input label="Observaciones" value={obs} onChange={e => setObs(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={guardar.isPending}>Registrar pago</Button>
      </div>
    </form>
  )
}

function FormCargo({ tarjeta, onClose }: { tarjeta: TarjetaCredito; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [desc, setDesc]   = useState('')
  const [error, setError] = useState('')

  const guardar = useMutation({
    mutationFn: () => tarjetasApi.cargo(tarjeta.id, { monto: Number(monto), fecha, descripcion: desc.trim() }),
    onSuccess: () => { refrescar(); toast.success('Cargo registrado.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <p className="text-sm text-[#5F6B7A]">Para gastos que no son compras de inventario: gasolina, servicios, intereses o comisiones del banco. Un monto negativo es un crédito a la tarjeta.</p>
      <Input label="Descripción *" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Comisión anual, gasolina…" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Monto (L) *" type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={guardar.isPending}>Registrar cargo</Button>
      </div>
    </form>
  )
}

function Movimientos({ tarjeta }: { tarjeta: TarjetaCredito }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [desde, setDesde] = useState(tarjeta.ultimo_corte ?? '')
  const [hasta, setHasta] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tarjeta-movs', tarjeta.id, desde, hasta],
    queryFn:  () => tarjetasApi.movimientos(tarjeta.id, { fecha_desde: desde || undefined, fecha_hasta: hasta || undefined }).then(r => r.data.data),
  })

  const anular = useMutation({
    mutationFn: (m: { tipo: 'cargo' | 'pago'; id: number }) => m.tipo === 'pago' ? tarjetasApi.anularPago(m.id) : tarjetasApi.anularCargo(m.id),
    onSuccess: () => { refrescar(); toast.success('Anulado.') },
    onError: err => toast.error(getAxiosError(err)),
  })

  const cargos = (data?.movimientos ?? []).filter(m => m.tipo === 'cargo' && !m.anulado).reduce((s, m) => s + m.monto, 0)
  const pagos  = (data?.movimientos ?? []).filter(m => m.tipo === 'pago' && !m.anulado).reduce((s, m) => s + m.monto, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[#5F6B7A]">Del</span>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5" />
        <span className="text-[#5F6B7A]">al</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5" />
        {tarjeta.ultimo_corte && (
          <button onClick={() => { setDesde(tarjeta.ultimo_corte!); setHasta('') }} className="text-xs font-semibold text-[var(--cp)] hover:underline">Desde el último corte</button>
        )}
        <button onClick={() => { setDesde(''); setHasta('') }} className="text-xs font-semibold text-[var(--cp)] hover:underline">Todo</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Dato l="Saldo anterior" v={data?.saldo_inicial ?? 0} />
        <Dato l="Cargos" v={cargos} />
        <Dato l="Pagos" v={pagos} verde />
        <Dato l="Se debe hoy" v={tarjeta.saldo} fuerte />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
      ) : (data?.movimientos.length ?? 0) === 0 ? (
        <p className="text-sm text-center text-[#5F6B7A] py-8">Sin movimientos en este período.</p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F7FA] text-[10px] uppercase tracking-wider text-[#5F6B7A] sticky top-0">
              <tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Detalle</th><th className="px-3 py-2 text-right">Cargo</th><th className="px-3 py-2 text-right">Pago</th><th className="px-3 py-2 text-right">Saldo</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data!.movimientos.map(m => (
                <tr key={`${m.tipo}${m.id}`} className={m.anulado ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 text-[#5F6B7A] whitespace-nowrap">{formatDate(m.fecha)}</td>
                  <td className="px-3 py-2">
                    <p className={cn('text-[var(--cs)]', m.anulado && 'line-through')}>{m.descripcion}</p>
                    <p className="text-[10px] text-[#5F6B7A]">{m.tipo === 'cargo' ? (ORIGEN[m.origen] ?? m.origen) : m.origen}{m.usuario ? ` · ${m.usuario}` : ''}{m.anulado ? ' · ANULADO' : ''}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--cs)]">{m.tipo === 'cargo' ? formatCurrency(m.monto) : ''}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{m.tipo === 'pago' ? formatCurrency(m.monto) : ''}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--cs)]">{formatCurrency(m.saldo)}</td>
                  <td className="px-2 py-2 text-right">
                    {!m.anulado && (m.tipo === 'pago' || m.origen === 'manual') && (
                      <button onClick={() => { if (confirm('¿Anular este movimiento?')) anular.mutate(m) }} title="Anular"
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Ban size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#5F6B7A]">Los cargos de requisiciones y compras se corrigen desde el documento: al cancelarlo o cambiar su forma de pago, el cargo se anula solo.</p>
    </div>
  )
}

function Dato({ l, v, verde, fuerte }: { l: string; v: number; verde?: boolean; fuerte?: boolean }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-[#F4F7FA]">
      <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">{l}</p>
      <p className={cn('font-bold', verde ? 'text-emerald-600' : 'text-[var(--cs)]', fuerte && 'text-base')}>{formatCurrency(v)}</p>
    </div>
  )
}
