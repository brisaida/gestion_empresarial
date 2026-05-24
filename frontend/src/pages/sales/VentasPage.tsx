import { useState, useRef, useEffect } from 'react'
import { Plus, XCircle, Search, Minus, Trash2, Receipt, User, Warehouse, CalendarDays, Hash } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { ventasApi, clientesApi, bodegasApi, productosApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Venta, EstadoVenta, Producto } from '@/types'

/* ── Helpers ─────────────────────────────────────────────────────── */
function EstadoBadge({ estado }: { estado: EstadoVenta }) {
  return estado === 'completada'
    ? <Badge variant="green">Completada</Badge>
    : <Badge variant="red">Cancelada</Badge>
}

interface LineaVenta {
  producto: Producto
  cantidad: number
  precio_unitario: number
}

const ISV_RATE = 0.15

/* ── Component ───────────────────────────────────────────────────── */
export default function VentasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  /* list state */
  const [page, setPage] = useState(1)

  /* form state */
  const [modal, setModal]       = useState(false)
  const [error, setError]       = useState('')
  const [clienteId, setClienteId]   = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [fecha, setFecha]           = useState(new Date().toISOString().slice(0, 10))
  const [nFactura, setNFactura]     = useState('')
  const [descuento, setDescuento]   = useState(0)
  const [aplicarISV, setAplicarISV] = useState(false)
  const [lineas, setLineas]         = useState<LineaVenta[]>([])

  /* product search */
  const [search, setSearch]           = useState('')
  const [showDrop, setShowDrop]       = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  /* cancel confirm */
  const [cancelarId, setCancelarId]   = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  /* data queries */
  const { data: clientes }  = useQuery({ queryKey: ['clientes-all', empresaId],  queryFn: () => clientesApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data),  enabled: empresaId > 0 })
  const { data: bodegas }   = useQuery({ queryKey: ['bodegas-all', empresaId],   queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),   enabled: empresaId > 0 })
  const { data: productos } = useQuery({ queryKey: ['productos-all', empresaId], queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data, isLoading } = useQuery({
    queryKey: ['ventas', empresaId, page],
    queryFn:  () => ventasApi.list({ empresa_id: empresaId, page, per_page: 15 }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  /* mutations */
  const crear = useMutation({
    mutationFn: (payload: unknown) => ventasApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      closeModal()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const cancelar = useMutation({
    mutationFn: (id: number) => ventasApi.cancelar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ventas'] }); setCancelarId(null); setActionError('') },
    onError: (err) => setActionError(getAxiosError(err)),
  })

  /* close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* computed */
  const filteredProducts = (productos ?? []).filter(p =>
    search.length > 0 &&
    (p.nombre.toLowerCase().includes(search.toLowerCase()) ||
     (p.codigo ?? '').toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8)

  const subtotal  = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const isv       = aplicarISV ? (subtotal - descuento) * ISV_RATE : 0
  const total     = subtotal - descuento + isv

  /* actions */
  const openModal = () => {
    setClienteId(''); setBodegaId(''); setFecha(new Date().toISOString().slice(0, 10))
    setNFactura(''); setDescuento(0); setAplicarISV(false); setLineas([])
    setSearch(''); setError('')
    setModal(true)
  }
  const closeModal = () => { setModal(false); setError('') }

  const addProduct = (p: Producto) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto.id === p.id)
      if (idx >= 0) {
        return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      }
      return [...prev, { producto: p, cantidad: 1, precio_unitario: Number(p.precio_venta) }]
    })
    setSearch('')
    setShowDrop(false)
  }

  const updateCantidad = (idx: number, delta: number) => {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const nueva = Math.max(1, l.cantidad + delta)
      return { ...l, cantidad: nueva }
    }))
  }

  const updatePrecio = (idx: number, value: string) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, precio_unitario: Number(value) || 0 } : l))
  }

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!bodegaId) { setError('Selecciona una bodega.'); return }
    if (lineas.length === 0) { setError('Agrega al menos un producto.'); return }
    await crear.mutateAsync({
      empresa_id:     empresaId,
      cliente_id:     clienteId ? Number(clienteId) : null,
      bodega_id:      Number(bodegaId),
      fecha_venta:    fecha,
      numero_factura: nFactura || null,
      descuento:      descuento,
      impuesto:       Math.round(isv * 10000) / 10000,
      detalles: lineas.map(l => ({
        producto_id:     l.producto.id,
        cantidad:        l.cantidad,
        precio_unitario: l.precio_unitario,
      })),
    })
  }

  /* list columns */
  const columns: Column<Venta>[] = [
    { key: 'numero_factura', header: 'N° Factura', cell: r => <span className="font-mono text-xs text-[#5F6B7A]">{r.numero_factura ?? '—'}</span>, width: '110px' },
    { key: 'cliente',        header: 'Cliente',    cell: r => <span className="font-semibold text-[#072B5A]">{r.cliente?.nombre ?? 'Consumidor final'}</span> },
    { key: 'bodega',         header: 'Bodega',     cell: r => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span> },
    { key: 'fecha_venta',    header: 'Fecha',      cell: r => <span className="text-[#5F6B7A]">{r.fecha_venta}</span>, align: 'center' },
    { key: 'total',          header: 'Total',      cell: r => <span className="font-bold text-emerald-600">{formatCurrency(r.total)}</span>, align: 'right' },
    { key: 'estado',         header: 'Estado',     cell: r => <EstadoBadge estado={r.estado} />, align: 'center', width: '110px' },
    {
      key: 'acciones', header: '', align: 'right', width: '60px',
      cell: r => r.estado === 'completada' ? (
        <button onClick={() => { setCancelarId(r.id); setActionError('') }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Cancelar venta">
          <XCircle size={15} />
        </button>
      ) : null,
    },
  ]

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Ventas</h1>
          <p className="text-sm text-[#5F6B7A]">Historial de facturas</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openModal}>Nueva venta</Button>
      </div>

      {/* Sales list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay ventas registradas." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>

      {/* ── Nueva Venta Modal ─────────────────────────────────────── */}
      <Modal open={modal} onClose={closeModal} title="Nueva venta" size="2xl">
        <form onSubmit={handleSubmit}>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* ── Section 1: Info de la factura ───────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">

            {/* Cliente */}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <User size={12} /> Cliente
              </label>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
              >
                <option value="">— Consumidor final —</option>
                {clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Bodega */}
            <div>
              <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Warehouse size={12} /> Bodega *
              </label>
              <select
                value={bodegaId}
                onChange={e => setBodegaId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
              >
                <option value="">Seleccionar</option>
                {bodegas?.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <CalendarDays size={12} /> Fecha *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
              />
            </div>

            {/* N° Factura */}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Hash size={12} /> N° de factura
              </label>
              <input
                type="text"
                placeholder="FAC-0001"
                value={nFactura}
                onChange={e => setNFactura(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
              />
            </div>
          </div>

          {/* ── Section 2: Buscador de productos ─────────────────── */}
          <div ref={searchRef} className="relative mb-3">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F4F7FA] border border-gray-200 rounded-xl focus-within:border-[#0E78D8] focus-within:ring-2 focus-within:ring-[#0E78D8]/20 transition-all">
              <Search size={16} className="text-[#5F6B7A] shrink-0" />
              <input
                type="text"
                placeholder="Buscar producto por nombre o código..."
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDrop(true) }}
                onFocus={() => search && setShowDrop(true)}
                className="flex-1 bg-transparent text-sm text-[#072B5A] placeholder-gray-400 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setShowDrop(false) }} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={15} />
                </button>
              )}
            </div>

            {/* Dropdown resultados */}
            {showDrop && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F4F7FA] transition-colors text-left group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#072B5A] group-hover:text-[#0E78D8] transition-colors">{p.nombre}</p>
                      {p.codigo && <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-[#0E78D8]">{formatCurrency(p.precio_venta)}</span>
                      <span className="w-6 h-6 bg-[#0E78D8] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDrop && search.length > 0 && filteredProducts.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl px-4 py-3 text-sm text-[#5F6B7A]">
                No se encontraron productos con "<strong>{search}</strong>"
              </div>
            )}
          </div>

          {/* ── Section 3: Tabla de líneas ───────────────────────── */}
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#F4F7FA] text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider">
              <div className="col-span-5">Producto</div>
              <div className="col-span-3 text-center">Cantidad</div>
              <div className="col-span-2 text-right">Precio unit.</div>
              <div className="col-span-1 text-right">Subtotal</div>
              <div className="col-span-1" />
            </div>

            {/* Empty state */}
            {lineas.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Receipt size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Busca y agrega productos usando el campo de arriba</p>
              </div>
            )}

            {/* Line items */}
            {lineas.map((l, i) => (
              <div
                key={l.producto.id}
                className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FA]/40'} hover:bg-[#F4F7FA] transition-colors`}
              >
                {/* Producto */}
                <div className="col-span-5">
                  <p className="text-sm font-semibold text-[#072B5A] leading-tight">{l.producto.nombre}</p>
                  {l.producto.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                </div>

                {/* Cantidad con +/- */}
                <div className="col-span-3 flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCantidad(i, -1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={l.cantidad}
                    onChange={e => setLineas(prev => prev.map((ln, idx) => idx === i ? { ...ln, cantidad: Math.max(1, Number(e.target.value) || 1) } : ln))}
                    className="w-12 text-center rounded-lg border border-gray-200 py-1 text-sm font-bold text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
                  />
                  <button
                    type="button"
                    onClick={() => updateCantidad(i, +1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* Precio unitario editable */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.precio_unitario}
                    onChange={e => updatePrecio(i, e.target.value)}
                    className="w-full text-right rounded-lg border border-gray-200 px-2 py-1 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
                  />
                </div>

                {/* Subtotal */}
                <div className="col-span-1 text-right">
                  <span className="text-sm font-bold text-[#072B5A]">
                    {formatCurrency(l.cantidad * l.precio_unitario)}
                  </span>
                </div>

                {/* Eliminar */}
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => removeLinea(i)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section 4: Totales + descuento/ISV ───────────────── */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">

            {/* Opciones descuento / ISV */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#5F6B7A] font-medium w-24">Descuento</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5F6B7A] font-bold">L</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={descuento || ''}
                    onChange={e => setDescuento(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-36 pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setAplicarISV(v => !v)}
                  className={`w-9 h-5 rounded-full transition-all cursor-pointer flex items-center px-0.5 ${aplicarISV ? 'bg-[#0E78D8]' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${aplicarISV ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-[#5F6B7A] font-medium group-hover:text-[#072B5A] transition-colors">
                  Aplicar ISV (15%)
                </span>
                {aplicarISV && <span className="text-xs text-[#0E78D8] font-semibold">= {formatCurrency(isv)}</span>}
              </label>
            </div>

            {/* Resumen total */}
            <div className="w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-sm text-[#5F6B7A]">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-sm text-[#5F6B7A]">
                  <span>Descuento</span>
                  <span className="font-medium text-red-500">− {formatCurrency(descuento)}</span>
                </div>
              )}
              {aplicarISV && (
                <div className="flex justify-between text-sm text-[#5F6B7A]">
                  <span>ISV (15%)</span>
                  <span className="font-medium">{formatCurrency(isv)}</span>
                </div>
              )}
              <div
                className="flex justify-between items-center mt-2 px-4 py-3 rounded-xl text-white font-bold text-base"
                style={{ background: 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)' }}
              >
                <span>TOTAL</span>
                <span className="text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              type="submit"
              loading={crear.isPending}
              icon={<Receipt size={15} />}
              disabled={lineas.length === 0}
            >
              Registrar venta
            </Button>
          </div>

        </form>
      </Modal>

      {/* ── Confirmar cancelar venta ──────────────────────────────── */}
      <Modal open={cancelarId !== null} onClose={() => setCancelarId(null)} title="Cancelar venta" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Cancelar esta venta? El stock <strong>no</strong> se revertirá automáticamente — registra un movimiento de entrada si es necesario.
        </p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending} onClick={() => cancelar.mutate(cancelarId!)}>Cancelar venta</Button>
        </div>
      </Modal>
    </div>
  )
}
