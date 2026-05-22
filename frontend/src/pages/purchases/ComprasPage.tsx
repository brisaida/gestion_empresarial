import { useState } from 'react'
import { Plus, Trash2, ShoppingCart, CheckCircle, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comprasApi, proveedoresApi, bodegasApi, productosApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Compra, EstadoCompra } from '@/types'

function EstadoBadge({ estado }: { estado: EstadoCompra }) {
  const map = { pendiente: { label: 'Pendiente', variant: 'yellow' as const }, recibida: { label: 'Recibida', variant: 'green' as const }, cancelada: { label: 'Cancelada', variant: 'red' as const } }
  const { label, variant } = map[estado]
  return <Badge variant={variant}>{label}</Badge>
}

interface LineaItem { producto_id: string; cantidad: string; costo_unitario: string; lote: string; fecha_vencimiento: string }
const emptyLinea = (): LineaItem => ({ producto_id: '', cantidad: '', costo_unitario: '', lote: '', fecha_vencimiento: '' })

export default function ComprasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ proveedor_id: '', bodega_id: '', fecha_compra: new Date().toISOString().slice(0, 10), numero_factura: '', descuento: '', impuesto: '' })
  const [lineas, setLineas] = useState<LineaItem[]>([emptyLinea()])
  const [recibirId, setRecibirId] = useState<number | null>(null)
  const [cancelarId, setCancelarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const { data: proveedores } = useQuery({ queryKey: ['proveedores-all', empresaId], queryFn: () => proveedoresApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas }     = useQuery({ queryKey: ['bodegas-all', empresaId],     queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data),     enabled: empresaId > 0 })
  const { data: productos }   = useQuery({ queryKey: ['productos-all', empresaId],   queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then((r) => r.data.data),   enabled: empresaId > 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['compras', empresaId, page],
    queryFn:  () => comprasApi.list({ empresa_id: empresaId, page, per_page: 15 }).then((r) => r.data),
    enabled:  empresaId > 0,
    placeholderData: (p) => p,
  })

  const crear = useMutation({
    mutationFn: (payload: unknown) => comprasApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compras'] }); closeModal() },
    onError: (err) => setError(getAxiosError(err)),
  })

  const recibir = useMutation({
    mutationFn: (id: number) => comprasApi.recibir(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compras'] }); qc.invalidateQueries({ queryKey: ['existencias'] }); setRecibirId(null); setActionError('') },
    onError: (err) => setActionError(getAxiosError(err)),
  })

  const cancelar = useMutation({
    mutationFn: (id: number) => comprasApi.cancelar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compras'] }); setCancelarId(null); setActionError('') },
    onError: (err) => setActionError(getAxiosError(err)),
  })

  const openModal = () => {
    setForm({ proveedor_id: '', bodega_id: '', fecha_compra: new Date().toISOString().slice(0, 10), numero_factura: '', descuento: '', impuesto: '' })
    setLineas([emptyLinea()])
    setError('')
    setModal(true)
  }
  const closeModal = () => { setModal(false); setError('') }

  const setLinea = (i: number, field: keyof LineaItem, value: string) => {
    setLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const subtotal = lineas.reduce((s, l) => s + (Number(l.cantidad) * Number(l.costo_unitario) || 0), 0)
  const total    = subtotal - (Number(form.descuento) || 0) + (Number(form.impuesto) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.proveedor_id || !form.bodega_id || !form.fecha_compra) { setError('Completa los campos requeridos.'); return }
    if (lineas.some((l) => !l.producto_id || !l.cantidad || !l.costo_unitario)) { setError('Cada línea necesita producto, cantidad y costo unitario.'); return }
    await crear.mutateAsync({
      empresa_id:     empresaId,
      proveedor_id:   Number(form.proveedor_id),
      bodega_id:      Number(form.bodega_id),
      fecha_compra:   form.fecha_compra,
      numero_factura: form.numero_factura || null,
      descuento:      form.descuento ? Number(form.descuento) : 0,
      impuesto:       form.impuesto ? Number(form.impuesto) : 0,
      detalles: lineas.map((l) => ({
        producto_id:       Number(l.producto_id),
        cantidad:          Number(l.cantidad),
        costo_unitario:    Number(l.costo_unitario),
        lote:              l.lote || null,
        fecha_vencimiento: l.fecha_vencimiento || null,
      })),
    })
  }

  const columns: Column<Compra>[] = [
    { key: 'numero_factura', header: 'Factura',    cell: (r) => <span className="font-mono text-xs text-[#5F6B7A]">{r.numero_factura ?? '—'}</span>, width: '100px' },
    { key: 'proveedor',      header: 'Proveedor',  cell: (r) => <span className="font-semibold text-[#072B5A]">{r.proveedor?.nombre ?? '—'}</span> },
    { key: 'bodega',         header: 'Bodega',     cell: (r) => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span> },
    { key: 'fecha_compra',   header: 'Fecha',      cell: (r) => <span className="text-[#5F6B7A]">{r.fecha_compra}</span>, align: 'center' },
    { key: 'total',          header: 'Total',      cell: (r) => <span className="font-bold text-[#072B5A]">{formatCurrency(r.total)}</span>, align: 'right' },
    { key: 'estado',         header: 'Estado',     cell: (r) => <EstadoBadge estado={r.estado} />, align: 'center', width: '110px' },
    {
      key: 'acciones', header: '', align: 'right', width: '100px',
      cell: (r) => r.estado === 'pendiente' ? (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => { setRecibirId(r.id); setActionError('') }} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Recibir compra"><CheckCircle size={15} /></button>
          <button onClick={() => { setCancelarId(r.id); setActionError('') }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Cancelar compra"><XCircle size={15} /></button>
        </div>
      ) : null,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Compras</h1>
          <p className="text-sm text-[#5F6B7A]">Órdenes de compra a proveedores</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openModal}>Nueva compra</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay compras registradas." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>

      {/* Modal crear compra */}
      <Modal open={modal} onClose={closeModal} title="Nueva orden de compra" size="xl">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Select label="Proveedor *" options={proveedores?.map((p) => ({ value: p.id, label: p.nombre })) ?? []} placeholder="Seleccionar" value={form.proveedor_id} onChange={(e) => setForm((f) => ({ ...f, proveedor_id: (e.target as HTMLSelectElement).value }))} required />
            <Select label="Bodega destino *" options={bodegas?.map((b) => ({ value: b.id, label: b.nombre })) ?? []} placeholder="Seleccionar" value={form.bodega_id} onChange={(e) => setForm((f) => ({ ...f, bodega_id: (e.target as HTMLSelectElement).value }))} required />
            <Input label="Fecha *" type="date" value={form.fecha_compra} onChange={(e) => setForm((f) => ({ ...f, fecha_compra: e.target.value }))} required />
            <Input label="N° Factura" value={form.numero_factura} onChange={(e) => setForm((f) => ({ ...f, numero_factura: e.target.value }))} placeholder="FAC-001" />
            <Input label="Descuento" type="number" step="0.01" min="0" value={form.descuento} onChange={(e) => setForm((f) => ({ ...f, descuento: e.target.value }))} placeholder="0.00" />
            <Input label="Impuesto / ISV" type="number" step="0.01" min="0" value={form.impuesto} onChange={(e) => setForm((f) => ({ ...f, impuesto: e.target.value }))} placeholder="0.00" />
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Productos</p>
              <button type="button" onClick={() => setLineas((p) => [...p, emptyLinea()])} className="text-xs text-[#0E78D8] hover:text-[#072B5A] font-semibold flex items-center gap-1 transition-colors">
                <Plus size={13} /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-[#F4F7FA] rounded-lg">
                  <div className="col-span-4">
                    {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Producto *</p>}
                    <select value={l.producto_id} onChange={(e) => setLinea(i, 'producto_id', e.target.value)} required className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all">
                      <option value="">Seleccionar</option>
                      {productos?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cantidad *</p>}
                    <input type="number" step="0.01" min="0.0001" value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} required placeholder="0" className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo unit. *</p>}
                    <input type="number" step="0.01" min="0" value={l.costo_unitario} onChange={(e) => setLinea(i, 'costo_unitario', e.target.value)} required placeholder="0.00" className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Subtotal</p>}
                    <div className="px-2 py-2 text-sm font-semibold text-[#072B5A] bg-white border border-gray-100 rounded-lg">
                      {formatCurrency(Number(l.cantidad) * Number(l.costo_unitario) || 0)}
                    </div>
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-0.5">
                    {lineas.length > 1 && (
                      <button type="button" onClick={() => setLineas((p) => p.filter((_, idx) => idx !== i))} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="mt-4 flex justify-end">
              <div className="bg-[#F4F7FA] rounded-xl p-4 min-w-56 space-y-1.5">
                <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Descuento</span><span className="font-medium text-red-500">− {formatCurrency(Number(form.descuento) || 0)}</span></div>
                <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Impuesto</span><span className="font-medium">{formatCurrency(Number(form.impuesto) || 0)}</span></div>
                <div className="flex justify-between text-base font-bold text-[#072B5A] pt-1.5 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={crear.isPending} icon={<ShoppingCart size={15} />}>Registrar compra</Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar recibir */}
      <Modal open={recibirId !== null} onClose={() => setRecibirId(null)} title="Recibir compra" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">¿Confirmar recepción? El stock será actualizado en la bodega de destino.</p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRecibirId(null)}>Cancelar</Button>
          <Button loading={recibir.isPending} icon={<CheckCircle size={15} />} onClick={() => recibir.mutate(recibirId!)}>Confirmar recepción</Button>
        </div>
      </Modal>

      {/* Confirmar cancelar */}
      <Modal open={cancelarId !== null} onClose={() => setCancelarId(null)} title="Cancelar compra" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">¿Cancelar esta orden de compra? El stock no será afectado.</p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending} onClick={() => cancelar.mutate(cancelarId!)}>Cancelar compra</Button>
        </div>
      </Modal>
    </div>
  )
}
