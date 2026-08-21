import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { movimientosApi, productosApi, bodegasApi, existenciasApi } from '@/api/recursos'
import { Pagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import ComboBox from '@/components/ui/ComboBox'
import { cn, getAxiosError, todayISO } from '@/lib/utils'
import type { Movimiento, TipoMovimiento } from '@/types'

const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: 'entrada',          label: 'Entrada' },
  { value: 'salida',           label: 'Salida' },
  { value: 'ajuste_positivo',  label: 'Ajuste positivo' },
  { value: 'ajuste_negativo',  label: 'Ajuste negativo' },
]

const TIPO_CONFIG: Record<TipoMovimiento, {
  label: string
  dot: string
  badge: string
  icon: typeof ArrowDownCircle
}> = {
  entrada:         { label: 'Entrada',     dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: ArrowDownCircle  },
  salida:          { label: 'Salida',      dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border-red-200',              icon: ArrowUpCircle    },
  ajuste_positivo: { label: 'Ajuste +',    dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200',           icon: SlidersHorizontal },
  ajuste_negativo: { label: 'Ajuste −',    dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',        icon: SlidersHorizontal },
}

interface LineaItem {
  producto_id: string
  cantidad: string
  costo_unitario: string
  lote: string
  fecha_vencimiento: string
}

const emptyLinea = (): LineaItem => ({ producto_id: '', cantidad: '', costo_unitario: '', lote: '', fecha_vencimiento: '' })

function MovimientoRow({ mov, isLast }: { mov: Movimiento; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  const cfg = TIPO_CONFIG[mov.tipo_movimiento]
  const Icon = cfg.icon

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full shrink-0 mt-4 ring-4 ring-white ${cfg.dot}`} />
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group"
        >
          <div className="flex items-start gap-4 px-4 py-4">

            {/* Ícono tipo */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.badge} border mt-0.5`}>
              <Icon size={15} />
            </div>

            {/* Bloque central */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
              {/* Col 1: tipo + bodega */}
              <div className="min-w-0">
                <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                  {cfg.label}
                </span>
                <p className="text-sm font-semibold text-[var(--cs)] mt-1 truncate">
                  {mov.bodega?.nombre ?? 'Sin bodega'}
                </p>
              </div>
              {/* Col 2: fecha + usuario */}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Fecha</p>
                <p className="text-sm text-[var(--cs)] font-mono mt-0.5">{mov.fecha}</p>
                {mov.usuario && (
                  <p className="text-xs text-gray-400 mt-0.5">{mov.usuario.nombre}</p>
                )}
              </div>
              {/* Col 3: observaciones + productos */}
              <div className="min-w-0">
                {mov.observaciones && (
                  <>
                    <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Observaciones</p>
                    <p className="text-sm text-[#5F6B7A] mt-0.5 truncate">{mov.observaciones}</p>
                  </>
                )}
                {mov.detalles && mov.detalles.length > 0 && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-[#5F6B7A] bg-gray-100 rounded-full px-2.5 py-0.5 font-medium">
                    {mov.detalles.length} producto{mov.detalles.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Flecha */}
            <span className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1 shrink-0">
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          </div>
        </button>

        {/* Detalle expandido */}
        {open && mov.detalles && mov.detalles.length > 0 && (
          <div className="mt-1 bg-[#F8FAFC] rounded-xl border border-gray-100 px-4 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide border-b border-gray-200 pb-1">
                  <th className="text-left pb-2">Producto</th>
                  <th className="text-right pb-2 w-20">Cantidad</th>
                  <th className="text-right pb-2 w-28">Costo unit.</th>
                  <th className="text-left pb-2 w-24 pl-4">Lote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mov.detalles.map((d, i) => (
                  <tr key={i}>
                    <td className="py-1.5 font-medium text-[var(--cs)]">
                      {d.producto?.nombre ?? `Producto #${d.producto_id}`}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-700">{d.cantidad}</td>
                    <td className="py-1.5 text-right font-mono text-gray-500">
                      {d.costo_unitario ? `L ${Number(d.costo_unitario).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-1.5 pl-4 text-gray-400 text-xs">{d.lote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MovimientosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | ''>('')
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ tipo_movimiento: '' as TipoMovimiento | '', bodega_id: '', fecha: todayISO(), observaciones: '' })
  const [lineas, setLineas] = useState<LineaItem[]>([emptyLinea()])

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', empresaId],
    queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled: empresaId > 0,
  })
  useEffect(() => {
    const pred = bodegas?.find(b => b.predeterminada)
    if (pred) setForm(f => f.bodega_id ? f : { ...f, bodega_id: String(pred.id) })
  }, [bodegas])

  const { data: productos } = useQuery({
    queryKey: ['productos-all', empresaId],
    queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data),
    enabled: empresaId > 0,
  })

  const requiereStock = form.tipo_movimiento === 'salida' || form.tipo_movimiento === 'ajuste_negativo'

  // Cuando se requiere stock y hay bodega, cargar existencias de esa bodega
  const { data: existenciasBodega } = useQuery({
    queryKey: ['existencias-modal', empresaId, form.bodega_id],
    queryFn: () => existenciasApi.list({ empresa_id: empresaId, bodega_id: form.bodega_id, per_page: 1000 }).then(r => r.data.data),
    enabled: requiereStock && !!form.bodega_id,
  })

  // Mapa producto_id → cantidad disponible en la bodega seleccionada
  const stockPorProducto = existenciasBodega
    ? Object.fromEntries(
        existenciasBodega.reduce((acc, e) => {
          const prev = acc.get(e.producto_id) ?? 0
          acc.set(e.producto_id, prev + e.cantidad_disponible)
          return acc
        }, new Map<number, number>())
      )
    : null

  const productosFiltrados = (() => {
    const todos = productos ?? []
    if (!requiereStock) return todos
    if (stockPorProducto) {
      // Filtrar por stock en la bodega específica
      return todos.filter(p => (stockPorProducto[p.id] ?? 0) > 0)
    }
    // Sin bodega seleccionada: usar stock total
    return todos.filter(p => (p.stock_total ?? 0) > 0)
  })()

  const getStockLabel = (productoId: number) => {
    if (!requiereStock) return null
    if (stockPorProducto) return stockPorProducto[productoId] ?? 0
    const prod = productos?.find(p => p.id === productoId)
    return prod?.stock_total ?? 0
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['movimientos', empresaId, page, filtroTipo],
    queryFn: () => movimientosApi.list({ empresa_id: empresaId, page, per_page: 15, ...(filtroTipo ? { tipo_movimiento: filtroTipo } : {}) }).then(r => r.data),
    enabled: empresaId > 0,
    placeholderData: p => p,
  })

  const crear = useMutation({
    mutationFn: (payload: unknown) => movimientosApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      closeModal()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const openModal = () => {
    setForm({ tipo_movimiento: '', bodega_id: '', fecha: todayISO(), observaciones: '' })
    setLineas([emptyLinea()])
    setError('')
    setModal(true)
  }
  const closeModal = () => { setModal(false); setError('') }

  const setLinea = (i: number, field: keyof LineaItem, value: string) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  const addLinea    = () => setLineas(p => [...p, emptyLinea()])
  const removeLinea = (i: number) => setLineas(p => p.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.tipo_movimiento || !form.fecha) { setError('Completa los campos requeridos.'); return }
    if (lineas.some(l => !l.producto_id || !l.cantidad)) { setError('Cada línea necesita producto y cantidad.'); return }
    await crear.mutateAsync({
      empresa_id:      empresaId,
      tipo_movimiento: form.tipo_movimiento,
      bodega_id:       form.bodega_id ? Number(form.bodega_id) : null,
      fecha:           form.fecha,
      observaciones:   form.observaciones || null,
      detalles: lineas.map(l => ({
        producto_id:       Number(l.producto_id),
        cantidad:          Number(l.cantidad),
        costo_unitario:    l.costo_unitario ? Number(l.costo_unitario) : null,
        lote:              l.lote || null,
        fecha_vencimiento: l.fecha_vencimiento || null,
      })),
    })
  }

  const movimientos: Movimiento[] = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--cs)]">Movimientos</h1>
          <p className="text-sm text-[#5F6B7A]">Historial de entradas, salidas y ajustes</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openModal}>Ajuste de inventario</Button>
      </div>

      {/* Filtros por tipo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFiltroTipo(''); setPage(1) }}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            filtroTipo === ''
              ? 'bg-[var(--cs)] text-white border-[var(--cs)] shadow-sm'
              : 'bg-white text-[#5F6B7A] border-gray-200 hover:border-gray-300'
          }`}
        >
          Todos
        </button>
        {(Object.entries(TIPO_CONFIG) as [TipoMovimiento, typeof TIPO_CONFIG[TipoMovimiento]][]).map(([tipo, cfg]) => (
          <button
            key={tipo}
            onClick={() => { setFiltroTipo(filtroTipo === tipo ? '' : tipo); setPage(1) }}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              filtroTipo === tipo
                ? `${cfg.badge} shadow-sm scale-105`
                : 'bg-white text-[#5F6B7A] border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {isLoading && (
        <div className="space-y-4 pl-7">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">Error al cargar los movimientos.</p>
      )}

      {!isLoading && !isError && movimientos.length === 0 && (
        <div className="text-center py-16 text-[#5F6B7A] bg-white rounded-xl border border-gray-100 shadow-sm">
          <SlidersHorizontal size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin movimientos registrados</p>
          <p className="text-sm mt-1">Crea el primero con el botón de arriba.</p>
        </div>
      )}

      {movimientos.length > 0 && (
        <div className="pl-2">
          {movimientos.map((mov, i) => (
            <MovimientoRow key={mov.id} mov={mov} isLast={i === movimientos.length - 1} />
          ))}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} onPage={p => { setPage(p); window.scrollTo(0, 0) }} />
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={closeModal} title="Ajuste de inventario" size="xl">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Tipo — selector visual */}
          <div>
            <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide mb-2">Tipo *</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS.map(({ value, label }) => {
                const cfg = TIPO_CONFIG[value]
                const Icon = cfg.icon
                const active = form.tipo_movimiento === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo_movimiento: value }))}
                    className={cn(
                      'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-xs font-semibold transition-all',
                      active
                        ? `${cfg.badge} border-current shadow-sm`
                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600',
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bodega + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComboBox
              label="Bodega"
              placeholder="— Sin asignar —"
              value={form.bodega_id}
              onChange={v => setForm(f => ({ ...f, bodega_id: v }))}
              options={bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []}
            />
            <Input label="Fecha *" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
          </div>

          <Input label="Observaciones" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Productos</p>
              <button type="button" onClick={addLinea} className="text-xs text-[var(--cp)] hover:text-[var(--cs)] font-semibold flex items-center gap-1 transition-colors">
                <Plus size={13} /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => {
                const prod = productos?.find(p => String(p.id) === l.producto_id)
                const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] transition-all'
                return (
                  <div key={i} className="bg-[#F4F7FA] rounded-xl p-3 space-y-3">
                    <div className="flex items-end gap-2">
                      {/* Producto */}
                      <div className="flex-1 min-w-0">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Producto *</p>}
                        <ComboBox
                          value={l.producto_id}
                          onChange={v => {
                            const prod = productos?.find(p => String(p.id) === v)
                            setLineas(prev => prev.map((row, idx) => idx === i
                              ? { ...row, producto_id: v, costo_unitario: prod?.costo ? String(prod.costo) : row.costo_unitario }
                              : row
                            ))
                          }}
                          options={productosFiltrados.map(p => {
                            const stock = getStockLabel(p.id)
                            return {
                              value: p.id,
                              label: stock !== null ? `${p.nombre} (${stock})` : p.nombre,
                            }
                          })}
                          placeholder="— Seleccionar producto —"
                        />
                      </div>
                      {/* Cantidad */}
                      <div className="w-28 shrink-0">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cantidad *</p>}
                        <input type="number" step="any" min="0.0001" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} placeholder="0" required className={inputCls} />
                      </div>
                      {/* Costo */}
                      <div className="w-32 shrink-0">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo unit.</p>}
                        <input type="number" step="0.01" min="0" value={l.costo_unitario} onChange={e => setLinea(i, 'costo_unitario', e.target.value)} placeholder="0.00" className={inputCls} />
                      </div>
                      {/* Eliminar */}
                      <div className="shrink-0">
                        {i === 0 && <div className="mb-1 h-[14px]" />}
                        {lineas.length > 1 ? (
                          <button type="button" onClick={() => removeLinea(i)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        ) : <div className="w-9" />}
                      </div>
                    </div>
                    {/* Lote / Vencimiento */}
                    {prod && (prod.maneja_lote || prod.maneja_vencimiento) && (
                      <div className="flex gap-3 pl-0">
                        {prod.maneja_lote && (
                          <div className="w-40">
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Lote</p>
                            <input value={l.lote} onChange={e => setLinea(i, 'lote', e.target.value)} placeholder="LOT-001" className={inputCls} />
                          </div>
                        )}
                        {prod.maneja_vencimiento && (
                          <div className="w-44">
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Fecha vencimiento</p>
                            <input type="date" value={l.fecha_vencimiento} onChange={e => setLinea(i, 'fecha_vencimiento', e.target.value)} className={inputCls} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              type="submit"
              loading={crear.isPending}
              icon={form.tipo_movimiento === 'entrada' || form.tipo_movimiento === 'ajuste_positivo'
                ? <ArrowDownCircle size={15} />
                : form.tipo_movimiento ? <ArrowUpCircle size={15} /> : <SlidersHorizontal size={15} />}
            >
              Registrar ajuste
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
