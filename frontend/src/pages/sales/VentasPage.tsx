import { useState, useRef, useEffect } from 'react'
import { Plus, XCircle, Search, Minus, Trash2, Receipt, User, Warehouse,
         CalendarDays, Hash, CheckCircle2, Lock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { ventasApi, clientesApi, bodegasApi, productosApi, empresaApi } from '@/api/recursos'
import { printVenta } from '@/lib/printVenta'
import type { Venta } from '@/types'
import Button from '@/components/ui/Button'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Producto } from '@/types'

interface LineaVenta {
  producto: Producto
  cantidad: number
  precio_unitario: number
}

const ISV_RATE = 0.15

export default function VentasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [clienteId, setClienteId]   = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [fecha, setFecha]           = useState(new Date().toISOString().slice(0, 10))
  const [nFactura, setNFactura]     = useState('')
  const [descuento, setDescuento]   = useState(0)
  const [aplicarISV, setAplicarISV] = useState(true)
  const [lineas, setLineas]         = useState<LineaVenta[]>([])

  const [search, setSearch]     = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { data: clientes }  = useQuery({ queryKey: ['clientes-all', empresaId],  queryFn: () => clientesApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas }   = useQuery({ queryKey: ['bodegas-all', empresaId],   queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: productos } = useQuery({ queryKey: ['productos-all', empresaId], queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data), enabled: empresaId > 0 })

  const { data: numData, refetch: refetchNum } = useQuery({
    queryKey: ['venta-siguiente-num', empresaId],
    queryFn:  () => ventasApi.siguienteNumero(empresaId).then(r => r.data.data.numero_factura),
    enabled:  empresaId > 0,
  })
  useEffect(() => { if (numData) setNFactura(numData) }, [numData])

  const crear = useMutation({
    mutationFn: (payload: unknown) => ventasApi.create(payload),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      const venta = (res.data as { data: Venta }).data
      resetForm(); refetchNum()
      setSuccess(`Factura ${venta.numero_factura} registrada correctamente.`)
      setTimeout(() => setSuccess(''), 6000)
      try {
        const [empresaRes, logoRes] = await Promise.all([
          empresaApi.get(empresaId),
          empresaApi.logoBase64(empresaId),
        ])
        printVenta(venta, empresaRes.data.data, logoRes.data.data.logo_base64 ?? undefined)
      } catch { /* PDF es opcional */ }
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filteredProducts = (productos ?? []).filter(p =>
    search.length > 0 &&
    (p.nombre.toLowerCase().includes(search.toLowerCase()) ||
     (p.codigo ?? '').toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8)

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const isv      = aplicarISV ? (subtotal - descuento) * ISV_RATE : 0
  const total    = subtotal - descuento + isv

  const resetForm = () => {
    setClienteId(''); setBodegaId(''); setFecha(new Date().toISOString().slice(0, 10))
    setDescuento(0); setAplicarISV(true); setLineas([])
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

  const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
  const labelCls  = "block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5"

  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Nueva Venta</h1>
        <p className="text-sm text-[#5F6B7A]">Registra una factura de venta</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={18} className="shrink-0" />{success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── FILA 1: datos de cabecera ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Hash size={11} /> N° Factura</span>
              </label>
              <div className="relative">
                <input readOnly value={nFactura}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-8 text-sm font-bold text-[#0E78D8] bg-[#F4F7FA] cursor-default select-none tracking-wide" />
                <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><User size={11} /> Cliente</span>
              </label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={selectCls}>
                <option value="">— Consumidor final —</option>
                {clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Warehouse size={11} /> Bodega *</span>
              </label>
              <select value={bodegaId} onChange={e => setBodegaId(e.target.value)} required className={selectCls}>
                <option value="">Seleccionar</option>
                {bodegas?.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><CalendarDays size={11} /> Fecha *</span>
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={selectCls} />
            </div>
          </div>
        </div>

        {/* ── FILA 2: detalle (izq) + totales (der) ──────────────── */}
        <div className="flex gap-4 items-start">

          {/* Tabla de detalle */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Buscador */}
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

                {showDrop && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                    {filteredProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => addProduct(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F4F7FA] transition-colors text-left group">
                        <div className="flex items-center gap-3">
                          {p.imagen_url
                            ? <img src={p.imagen_url} className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
                            : <div className="w-8 h-8 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0 flex items-center justify-center text-[9px] font-bold text-gray-300">IMG</div>
                          }
                          <div>
                            <p className="text-sm font-semibold text-[#072B5A] group-hover:text-[#0E78D8] transition-colors">{p.nombre}</p>
                            {p.codigo && <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {p.stock_total !== undefined && <span className="text-xs text-[#5F6B7A]">Stock: {p.stock_total}</span>}
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

            {/* Encabezado tabla */}
            {lineas.length > 0 && (
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F4F7FA]/70 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider border-b border-gray-100">
                <div className="col-span-4">Producto</div>
                <div className="col-span-3 text-center">Cantidad</div>
                <div className="col-span-2 text-right">Precio unit.</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>
            )}

            {/* Empty state */}
            {lineas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
                  <Receipt size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-[#5F6B7A]">Sin productos aún</p>
                <p className="text-xs text-gray-400 mt-1">Usa el buscador de arriba para agregar productos</p>
              </div>
            )}

            {/* Filas */}
            {lineas.map((l, i) => (
              <div key={l.producto.id}
                className={`grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FA]/25'} hover:bg-[#F4F7FA]/60 transition-colors`}>

                <div className="col-span-4 flex items-center gap-2.5">
                  {l.producto.imagen_url
                    ? <img src={l.producto.imagen_url} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                    : <div className="w-9 h-9 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#072B5A] leading-tight truncate">{l.producto.nombre}</p>
                    {l.producto.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                  </div>
                </div>

                <div className="col-span-3 flex items-center justify-center gap-1.5">
                  <button type="button" onClick={() => updateCantidad(i, -1)}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all">
                    <Minus size={12} />
                  </button>
                  <input type="number" min="1" step="1" value={l.cantidad}
                    onChange={e => setLineas(prev => prev.map((ln, idx) => idx === i ? { ...ln, cantidad: Math.max(1, Number(e.target.value) || 1) } : ln))}
                    className="w-14 text-center rounded-lg border border-gray-200 py-1.5 text-sm font-bold text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
                  <button type="button" onClick={() => updateCantidad(i, +1)}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all">
                    <Plus size={12} />
                  </button>
                </div>

                <div className="col-span-2">
                  <input type="number" min="0" step="0.01" value={l.precio_unitario}
                    onChange={e => updatePrecio(i, e.target.value)}
                    className="w-full text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
                </div>

                <div className="col-span-2 text-right">
                  <span className="text-sm font-bold text-[#072B5A]">{formatCurrency(l.cantidad * l.precio_unitario)}</span>
                </div>

                <div className="col-span-1 flex justify-center">
                  <button type="button" onClick={() => removeLinea(i)}
                    className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Panel de totales */}
          <div className="w-64 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">

            <p className="text-xs font-bold text-[#072B5A] uppercase tracking-wider">Resumen</p>

            {/* Descuento */}
            <div>
              <label className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5 block">Descuento</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5F6B7A] font-bold pointer-events-none">L</span>
                <input type="number" min="0" step="0.01"
                  value={descuento || ''} onChange={e => setDescuento(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-right text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
                />
              </div>
            </div>

            {/* ISV toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#5F6B7A]">ISV (15%)</span>
              <button type="button" onClick={() => setAplicarISV(v => !v)}
                style={{ height: '22px', width: '40px' }}
                className={`rounded-full transition-all flex items-center px-0.5 ${aplicarISV ? 'bg-[#0E78D8]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${aplicarISV ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Desglose */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
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

            {/* Total */}
            <div className="flex justify-between items-center px-4 py-3.5 rounded-xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 60%, #38D6D4 100%)' }}>
              <span className="text-sm">TOTAL</span>
              <span className="text-lg tracking-tight">{formatCurrency(total)}</span>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Acciones */}
            <div className="space-y-2 pt-1">
              <Button type="submit" loading={crear.isPending} icon={<Receipt size={15} />}
                disabled={lineas.length === 0} className="w-full justify-center">
                Registrar venta
              </Button>
              <button type="button" onClick={resetForm}
                className="w-full py-1.5 rounded-lg text-xs text-[#5F6B7A] hover:text-red-500 hover:bg-red-50 transition-colors font-medium text-center">
                Limpiar formulario
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
