import { useState } from 'react'
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { movimientosApi, productosApi, bodegasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { getAxiosError } from '@/lib/utils'
import type { Movimiento, TipoMovimiento } from '@/types'

const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: 'entrada',          label: 'Entrada' },
  { value: 'salida',           label: 'Salida' },
  { value: 'ajuste_positivo',  label: 'Ajuste positivo' },
  { value: 'ajuste_negativo',  label: 'Ajuste negativo' },
]

function TipoBadge({ tipo }: { tipo: TipoMovimiento }) {
  const map: Record<TipoMovimiento, { label: string; variant: 'green' | 'red' | 'blue' | 'yellow' }> = {
    entrada:         { label: 'Entrada',           variant: 'green' },
    salida:          { label: 'Salida',             variant: 'red' },
    ajuste_positivo: { label: 'Ajuste +',           variant: 'blue' },
    ajuste_negativo: { label: 'Ajuste −',           variant: 'yellow' },
  }
  const { label, variant } = map[tipo]
  return <Badge variant={variant}>{label}</Badge>
}

interface LineaItem {
  producto_id: string
  cantidad: string
  costo_unitario: string
  lote: string
  fecha_vencimiento: string
}

const emptyLinea = (): LineaItem => ({ producto_id: '', cantidad: '', costo_unitario: '', lote: '', fecha_vencimiento: '' })

export default function MovimientosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ tipo_movimiento: '' as TipoMovimiento | '', bodega_id: '', fecha: new Date().toISOString().slice(0, 10), numero_documento: '', observaciones: '' })
  const [lineas, setLineas] = useState<LineaItem[]>([emptyLinea()])

  const { data: bodegas }   = useQuery({ queryKey: ['bodegas-all', empresaId],   queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data),   enabled: empresaId > 0 })
  const { data: productos } = useQuery({ queryKey: ['productos-all', empresaId], queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then((r) => r.data.data), enabled: empresaId > 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['movimientos', empresaId, page],
    queryFn:  () => movimientosApi.list({ empresa_id: empresaId, page, per_page: 15 }).then((r) => r.data),
    enabled:  empresaId > 0,
    placeholderData: (p) => p,
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
    setForm({ tipo_movimiento: '', bodega_id: '', fecha: new Date().toISOString().slice(0, 10), numero_documento: '', observaciones: '' })
    setLineas([emptyLinea()])
    setError('')
    setModal(true)
  }
  const closeModal = () => { setModal(false); setError('') }

  const setLinea = (i: number, field: keyof LineaItem, value: string) => {
    setLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }
  const addLinea    = () => setLineas((p) => [...p, emptyLinea()])
  const removeLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.tipo_movimiento || !form.bodega_id || !form.fecha) { setError('Completa los campos requeridos.'); return }
    if (lineas.some((l) => !l.producto_id || !l.cantidad)) { setError('Cada línea necesita producto y cantidad.'); return }
    await crear.mutateAsync({
      empresa_id:       empresaId,
      tipo_movimiento:  form.tipo_movimiento,
      bodega_id:        Number(form.bodega_id),
      fecha:            form.fecha,
      numero_documento: form.numero_documento || null,
      observaciones:    form.observaciones || null,
      detalles: lineas.map((l) => ({
        producto_id:       Number(l.producto_id),
        cantidad:          Number(l.cantidad),
        costo_unitario:    l.costo_unitario ? Number(l.costo_unitario) : null,
        lote:              l.lote || null,
        fecha_vencimiento: l.fecha_vencimiento || null,
      })),
    })
  }

  const columns: Column<Movimiento>[] = [
    { key: 'tipo',   header: 'Tipo',       cell: (r) => <TipoBadge tipo={r.tipo_movimiento} />, width: '130px' },
    { key: 'bodega', header: 'Bodega',     cell: (r) => <span className="text-[#072B5A] font-medium">{r.bodega?.nombre ?? '—'}</span> },
    { key: 'doc',    header: 'Documento',  cell: (r) => <span className="text-[#5F6B7A] font-mono text-xs">{r.numero_documento ?? '—'}</span> },
    { key: 'fecha',  header: 'Fecha',      cell: (r) => <span className="text-[#5F6B7A]">{r.fecha}</span>, align: 'center' },
    { key: 'obs',    header: 'Observaciones', cell: (r) => <span className="text-[#5F6B7A] text-xs truncate max-w-xs block">{r.observaciones ?? '—'}</span> },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Movimientos</h1>
          <p className="text-sm text-[#5F6B7A]">Entradas, salidas y ajustes de inventario</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openModal}>Nuevo movimiento</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay movimientos registrados." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>

      <Modal open={modal} onClose={closeModal} title="Registrar movimiento" size="xl">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide block mb-1">Tipo *</label>
              <select
                value={form.tipo_movimiento}
                onChange={(e) => setForm((f) => ({ ...f, tipo_movimiento: e.target.value as TipoMovimiento }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
                required
              >
                <option value="">Seleccionar tipo</option>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Select
              label="Bodega *"
              options={bodegas?.map((b) => ({ value: b.id, label: b.nombre })) ?? []}
              placeholder="Seleccionar bodega"
              value={form.bodega_id}
              onChange={(e) => setForm((f) => ({ ...f, bodega_id: (e.target as HTMLSelectElement).value }))}
              required
            />
            <Input label="Fecha *" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
            <Input label="N° Documento" value={form.numero_documento} onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))} placeholder="MOV-001" />
            <div className="col-span-2">
              <Input label="Observaciones" value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>

          {/* Líneas de detalle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Productos</p>
              <button type="button" onClick={addLinea} className="text-xs text-[#0E78D8] hover:text-[#072B5A] font-semibold flex items-center gap-1 transition-colors">
                <Plus size={13} /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => {
                const prod = productos?.find(p => String(p.id) === l.producto_id)
                const inputCls = 'w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all'
                return (
                  <div key={i} className="bg-[#F4F7FA] rounded-lg">
                    <div className="grid grid-cols-12 gap-2 items-end p-3">
                      <div className="col-span-4">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Producto *</p>}
                        <select value={l.producto_id} onChange={(e) => setLinea(i, 'producto_id', e.target.value)} className={`${inputCls} text-[#072B5A]`} required>
                          <option value="">Seleccionar</option>
                          {productos?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cantidad *</p>}
                        <input type="number" step="any" min="0.0001" value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} placeholder="0" required className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo unit.</p>}
                        <input type="number" step="0.01" min="0" value={l.costo_unitario} onChange={(e) => setLinea(i, 'costo_unitario', e.target.value)} placeholder="0.00" className={inputCls} />
                      </div>
                      <div className="col-span-3" />
                      <div className="col-span-1 flex justify-end">
                        {lineas.length > 1 && (
                          <button type="button" onClick={() => removeLinea(i)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    {prod && (prod.maneja_lote || prod.maneja_vencimiento) && (
                      <div className="flex gap-3 px-3 pb-3 -mt-1">
                        {prod.maneja_lote && (
                          <div className="w-40">
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Lote</p>
                            <input value={l.lote} onChange={(e) => setLinea(i, 'lote', e.target.value)} placeholder="LOT-001" className={inputCls} />
                          </div>
                        )}
                        {prod.maneja_vencimiento && (
                          <div className="w-44">
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Fecha vencimiento</p>
                            <input type="date" value={l.fecha_vencimiento} onChange={(e) => setLinea(i, 'fecha_vencimiento', e.target.value)} className={inputCls} />
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
              icon={form.tipo_movimiento === 'entrada' || form.tipo_movimiento === 'ajuste_positivo' ? <ArrowDownCircle size={15} /> : form.tipo_movimiento ? <ArrowUpCircle size={15} /> : <SlidersHorizontal size={15} />}
            >
              Registrar movimiento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
