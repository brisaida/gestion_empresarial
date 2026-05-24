import { useState, useRef, useEffect } from 'react'
import { Plus, XCircle, Search, Minus, Trash2, Receipt, User, Warehouse,
         CalendarDays, Hash, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
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
  const [page, setPage]             = useState(1)
  const [showHistory, setShowHistory] = useState(true)

  /* form state */
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [clienteId, setClienteId]   = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [fecha, setFecha]           = useState(new Date().toISOString().slice(0, 10))
  const [nFactura, setNFactura]     = useState('')
  const [descuento, setDescuento]   = useState(0)
  const [aplicarISV, setAplicarISV] = useState(false)
  const [lineas, setLineas]         = useState<LineaVenta[]>([])

  /* product search */
  const [search, setSearch]         = useState('')
  const [showDrop, setShowDrop]     = useState(false)
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
    queryFn:  () => ventasApi.list({ empresa_id: empresaId, page, per_page: 10 }).then(r => r.data),
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
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
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

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const isv      = aplicarISV ? (subtotal - descuento) * ISV_RATE : 0
  const total    = subtotal - descuento + isv

  /* actions */
  const resetForm = () => {
    setClienteId(''); setBodegaId(''); setFecha(new Date().toISOString().slice(0, 10))
    setNFactura(''); setDescuento(0); setAplicarISV(false); setLineas([])
    setSearch(''); setError('')
  }

  const addProduct = (p: Producto) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto.id === p.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...prev, { producto: p, cantidad: 1, precio_unitario: Number(p.precio_venta) }]
    })
    setSearch(''); setShowDrop(false)
  }

  const updateCantidad = (idx: number, delta: number) =>
    setLineas(prev => prev.map((l, i) => i !== idx ? l : { ...l, cantidad: Math.max(1, l.cantidad + delta) }))

  const updatePrecio = (idx: number, value: string) =>
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, precio_unitario: Number(value) || 0 } : l))

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
      descuento,
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
        <button
          onClick={() => { setCancelarId(r.id); setActionError('') }}
          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Cancelar venta"
        >
          <XCircle size={15} />
        </button>
      ) : null,
    },
  ]

  const fieldCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
  const labelCls = "text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide flex items-center gap-1.5 mb-1.5"

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Nueva Venta</h1>
        <p className="text-sm text-[#5F6B7A]">Registra una factura de venta</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={18} className="shrink-0" />
          Venta registrada exitosamente. El inventario ha sido actualizado.
        </div>
      )}

      {/* ── Main billing layout ───────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="flex gap-5 items-start">

          {/* ══ LEFT PANEL — product search + line items ══════════════ */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#F4F7FA]/60">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-[#0E78D8]" />
                <span className="text-sm font-semibold text-[#072B5A]">Líneas de la factura</span>
              </div>
              <span className="text-xs text-[#5F6B7A]">{lineas.length} producto{lineas.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Product search */}
            <div className="p-4 border-b border-gray-100" ref={searchRef}>
              <div className="relative">
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
                        <div className="flex items-center gap-3">
                          {p.imagen_url
                            ? <img src={p.imagen_url} className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                            : <div className="w-8 h-8 rounded-lg bg-[#F4F7FA] border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-300">IMG</div>
                          }
                          <div>
                            <p className="text-sm font-semibold text-[#072B5A] group-hover:text-[#0E78D8] transition-colors">{p.nombre}</p>
                            {p.codigo && <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {p.stock_total !== undefined && (
                            <span className="text-xs text-[#5F6B7A]">Stock: {p.stock_total}</span>
                          )}
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
            </div>

            {/* Line items table */}
            <div className="min-h-[260px]">
              {/* Table header */}
              {lineas.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F4F7FA]/60 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider border-b border-gray-100">
                  <div className="col-span-5">Producto</div>
                  <div className="col-span-3 text-center">Cantidad</div>
                  <div className="col-span-2 text-right">Precio unit.</div>
                  <div className="col-span-1 text-right">Subtotal</div>
                  <div className="col-span-1" />
                </div>
              )}

              {/* Empty state */}
              {lineas.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[260px] text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
                    <Receipt size={28} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-[#5F6B7A]">Sin productos aún</p>
                  <p className="text-xs text-gray-400 mt-1">Busca y agrega productos usando el campo de arriba</p>
                </div>
              )}

              {/* Line rows */}
              {lineas.map((l, i) => (
                <div
                  key={l.producto.id}
                  className={`grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FA]/30'} hover:bg-[#F4F7FA]/60 transition-colors`}
                >
                  {/* Producto */}
                  <div className="col-span-5 flex items-center gap-2.5">
                    {l.producto.imagen_url
                      ? <img src={l.producto.imagen_url} className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
                      : <div className="w-8 h-8 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-semibold text-[#072B5A] leading-tight">{l.producto.nombre}</p>
                      {l.producto.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className="col-span-3 flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateCantidad(i, -1)}
                      className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number" min="1" step="1"
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

                  {/* Precio unitario */}
                  <div className="col-span-2">
                    <input
                      type="number" min="0" step="0.01"
                      value={l.precio_unitario}
                      onChange={e => updatePrecio(i, e.target.value)}
                      className="w-full text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
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
          </div>

          {/* ══ RIGHT PANEL — invoice details + totals + submit ═══════ */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Invoice metadata card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-bold text-[#072B5A] uppercase tracking-wider">Datos de la factura</p>

              {/* Cliente */}
              <div>
                <label className={labelCls}><User size={12} /> Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={fieldCls}>
                  <option value="">— Consumidor final —</option>
                  {clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              {/* Bodega */}
              <div>
                <label className={labelCls}><Warehouse size={12} /> Bodega *</label>
                <select value={bodegaId} onChange={e => setBodegaId(e.target.value)} required className={fieldCls}>
                  <option value="">Seleccionar</option>
                  {bodegas?.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className={labelCls}><CalendarDays size={12} /> Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={fieldCls} />
              </div>

              {/* N° Factura */}
              <div>
                <label className={labelCls}><Hash size={12} /> N° de factura</label>
                <input
                  type="text" placeholder="FAC-0001"
                  value={nFactura} onChange={e => setNFactura(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>

            {/* Totals card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-xs font-bold text-[#072B5A] uppercase tracking-wider">Totales</p>

              {/* Descuento */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-[#5F6B7A] font-medium shrink-0">Descuento</label>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5F6B7A] font-bold pointer-events-none">L</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={descuento || ''}
                    onChange={e => setDescuento(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm text-right text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
                  />
                </div>
              </div>

              {/* ISV toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5F6B7A] font-medium">ISV (15%)</span>
                <button
                  type="button"
                  onClick={() => setAplicarISV(v => !v)}
                  className={`w-10 h-5.5 rounded-full transition-all flex items-center px-0.5 ${aplicarISV ? 'bg-[#0E78D8]' : 'bg-gray-200'}`}
                  style={{ height: '22px', width: '40px' }}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${aplicarISV ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Breakdown */}
              <div className="border-t border-gray-100 pt-3 space-y-1.5">
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
              </div>

              {/* Total box */}
              <div
                className="flex justify-between items-center px-4 py-3.5 rounded-xl text-white font-bold"
                style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 60%, #38D6D4 100%)' }}
              >
                <span className="text-sm">TOTAL</span>
                <span className="text-xl tracking-tight">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                loading={crear.isPending}
                icon={<Receipt size={15} />}
                disabled={lineas.length === 0}
                className="w-full justify-center"
              >
                Registrar venta
              </Button>
              <button
                type="button"
                onClick={resetForm}
                className="w-full py-2 rounded-lg text-sm text-[#5F6B7A] hover:text-red-500 hover:bg-red-50 transition-colors font-medium"
              >
                Limpiar formulario
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Historial de ventas ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#F4F7FA]/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-[#0E78D8] inline-block" />
            <span className="text-sm font-semibold text-[#072B5A]">Historial de ventas</span>
            {data?.meta?.total !== undefined && (
              <span className="ml-1 text-xs text-[#5F6B7A]">({data.meta.total} registros)</span>
            )}
          </div>
          {showHistory ? <ChevronUp size={16} className="text-[#5F6B7A]" /> : <ChevronDown size={16} className="text-[#5F6B7A]" />}
        </button>
        {showHistory && (
          <>
            <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay ventas registradas." />
            {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
          </>
        )}
      </div>

      {/* ── Modal confirmar cancelar venta ─────────────────────────── */}
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
