import { useState, useRef, useEffect } from 'react'
import { Plus, XCircle, Search, Minus, Trash2, Receipt, User, Warehouse,
         CalendarDays, Hash, Lock, ChefHat, Package, LayoutGrid, UtensilsCrossed, TableProperties, Banknote, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { ventasApi, clientesApi, bodegasApi, productosApi, empresaApi, recetasApi, comandasApi, sesionCajaApi } from '@/api/recursos'
import { printVenta } from '@/lib/printVenta'
import type { Venta, Receta } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, getAxiosError, todayISO } from '@/lib/utils'
import type { Producto } from '@/types'
import { useNavigate } from 'react-router-dom'

interface LineaVenta {
  _key: string
  tipo: 'producto' | 'receta'
  producto?: Producto
  receta?: Receta
  cantidad: number
  precio_unitario: number
}

type CategoriaTab = 'todos' | 'platos' | 'productos'

export default function VentasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()
  const navigate = useNavigate()

  const toast = useToast()
  const [stockModal, setStockModal] = useState<{
    open: boolean
    mensaje: string
    alternativas: { id: number; nombre: string }[]
  }>({ open: false, mensaje: '', alternativas: [] })
  const [clienteId, setClienteId]   = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [fecha, setFecha]           = useState(todayISO())
  const [nFactura, setNFactura]     = useState('')
  const [descuento, setDescuento]   = useState(0)
  const [aplicarISV, setAplicarISV] = useState(true)
  const [lineas, setLineas]         = useState<LineaVenta[]>([])

  const [metodoPago, setMetodoPago] = useState<'efectivo'|'tarjeta'|'transferencia'|'mixto'>('efectivo')

  const [search, setSearch]         = useState('')
  const [showDrop, setShowDrop]     = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [mesa, setMesa]             = useState('')

  // Tablet POS state
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaTab>('todos')
  const [tabletSearch, setTabletSearch]       = useState('')

  const { data: sesionActual } = useQuery({
    queryKey: ['caja-actual', empresaId],
    queryFn:  () => sesionCajaApi.actual(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 30_000,
  })
  const sinSesion = sesionActual === null

  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 5 * 60_000,
  })
  const { data: clientes }  = useQuery({ queryKey: ['clientes-all', empresaId],  queryFn: () => clientesApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas }   = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
    select: (data) => { const pred = data?.find(b => b.predeterminada); if (pred && !bodegaId) setBodegaId(String(pred.id)); return data },
  })
  const { data: productos } = useQuery({ queryKey: ['productos-all', empresaId], queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, solo_activos: true }).then(r => r.data.data), enabled: empresaId > 0 })
  const esRestaurante = state.empresaActiva?.rubro === 'restaurante'
  const { data: recetas = [] } = useQuery({ queryKey: ['recetas', empresaId], queryFn: () => recetasApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => (r.data as { data: Receta[] }).data), enabled: empresaId > 0 && esRestaurante })

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
      toast.success(`Factura ${venta.numero_factura} registrada correctamente.`)
      try {
        const [empresaRes, logoRes] = await Promise.all([
          empresaApi.get(empresaId),
          empresaApi.logoBase64(empresaId),
        ])
        printVenta(venta, empresaRes.data.data, logoRes.data.data.logo_base64 ?? undefined)
      } catch { /* PDF es opcional */ }
    },
    onError: (err) => {
      if (err && typeof err === 'object' && 'response' in err) {
        const data = (err as { response: { data: Record<string, unknown> } }).response?.data
        if (data && 'bodegas_alternativas' in data) {
          setStockModal({
            open: true,
            mensaje: String(data.message ?? getAxiosError(err)),
            alternativas: Array.isArray(data.bodegas_alternativas)
              ? data.bodegas_alternativas as { id: number; nombre: string }[]
              : [],
          })
          return
        }
      }
      toast.error(getAxiosError(err))
    },
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
  ).slice(0, 6)

  const filteredRecetas = esRestaurante ? recetas.filter(r =>
    search.length > 0 && r.nombre.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 4) : []

  const showDrop2 = showDrop && search.length > 0 && (filteredProducts.length > 0 || filteredRecetas.length > 0)

  // Tablet POS: ítems filtrados por categoría y búsqueda
  const gridRecetas = (esRestaurante && categoriaActiva !== 'productos')
    ? recetas.filter(r => r.activo !== false &&
        (!tabletSearch || r.nombre.toLowerCase().includes(tabletSearch.toLowerCase())))
    : []
  const gridProductos = categoriaActiva !== 'platos'
    ? (productos ?? []).filter(p =>
        !tabletSearch ||
        p.nombre.toLowerCase().includes(tabletSearch.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(tabletSearch.toLowerCase()))
    : []

  const getQtyReceta   = (id: number) => lineas.find(l => l.tipo === 'receta'   && l.receta?.id   === id)?.cantidad ?? 0
  const getQtyProducto = (id: number) => lineas.find(l => l.tipo === 'producto' && l.producto?.id === id)?.cantidad ?? 0
  const totalItems = lineas.reduce((s, l) => s + l.cantidad, 0)

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const isv = aplicarISV && subtotal > 0
    ? lineas.reduce((sum, l) => {
        const rate = (l.tipo === 'producto' && l.producto?.tasa_isv != null
          ? l.producto.tasa_isv
          : (empresaConfig?.isv_rate ?? 15)) / 100
        const lineaBase = l.cantidad * l.precio_unitario
        const lineaDescontada = descuento > 0 ? lineaBase * (1 - descuento / subtotal) : lineaBase
        return sum + lineaDescontada * rate
      }, 0)
    : 0
  const total = subtotal - descuento + isv

  const enviarCocina = useMutation({
    mutationFn: async () => {
      if (!bodegaId) throw new Error('Selecciona una bodega.')
      if (lineas.length === 0) throw new Error('Agrega al menos un ítem.')
      const numRes = await comandasApi.siguienteNumero(empresaId)
      const numero = (numRes.data as { data: { numero_comanda: string } }).data.numero_comanda
      return comandasApi.create({
        empresa_id:     empresaId,
        bodega_id:      Number(bodegaId),
        numero_comanda: numero,
        mesa:           mesa || null,
        detalles: lineas.map(l => ({
          producto_id:     l.tipo === 'producto' ? l.producto!.id : null,
          receta_id:       l.tipo === 'receta'   ? l.receta!.id   : null,
          nombre_item:     l.tipo === 'receta'   ? l.receta!.nombre : l.producto!.nombre,
          cantidad:        l.cantidad,
          precio_unitario: l.precio_unitario,
        })),
      })
    },
    onSuccess: (res) => {
      const c = (res.data as { data: { numero_comanda: string } }).data
      resetForm(); setMesa('')
      toast.info(`Pedido ${c.numero_comanda} enviado a cocina.`)
    },
    onError: (err) => setError(err instanceof Error ? err.message : getAxiosError(err)),
  })

  const resetForm = () => {
    setClienteId(''); setBodegaId(''); setFecha(todayISO())
    setDescuento(0); setAplicarISV(true); setLineas([])
    setMetodoPago('efectivo'); setSearch('')
  }

  const addProduct = (p: Producto) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.tipo === 'producto' && l.producto?.id === p.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...prev, { _key: `p-${p.id}`, tipo: 'producto', producto: p, cantidad: 1, precio_unitario: Number(p.precio_venta) }]
    })
    setSearch(''); setShowDrop(false)
  }

  const addReceta = (r: Receta) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.tipo === 'receta' && l.receta?.id === r.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...prev, { _key: `r-${r.id}`, tipo: 'receta', receta: r, cantidad: 1, precio_unitario: Number(r.precio_venta) }]
    })
    setSearch(''); setShowDrop(false)
  }

  const updateCantidad = (idx: number, delta: number) =>
    setLineas(prev => prev.map((l, i) => i !== idx ? l : { ...l, cantidad: Math.max(1, l.cantidad + delta) }))

  const updatePrecio = (idx: number, value: string) =>
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, precio_unitario: Number(value) || 0 } : l))

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const buildPayload = (bid: string) => ({
    empresa_id:     empresaId,
    cliente_id:     clienteId ? Number(clienteId) : null,
    bodega_id:      Number(bid),
    fecha_venta:    fecha,
    numero_factura: nFactura || null,
    descuento,
    impuesto:       Math.round(isv * 10000) / 10000,
    metodo_pago:    metodoPago,
    detalles: lineas.map(l => ({
      producto_id:     l.tipo === 'producto' ? l.producto!.id : null,
      receta_id:       l.tipo === 'receta'   ? l.receta!.id   : null,
      cantidad:        l.cantidad,
      precio_unitario: l.precio_unitario,
    })),
  })

  const cambiarBodega = (nuevoBodegaId: number) => {
    setBodegaId(String(nuevoBodegaId))
    setStockModal(s => ({ ...s, open: false }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bodegaId) { toast.warning('Selecciona una bodega.'); return }
    if (lineas.length === 0) { toast.warning('Agrega al menos un producto.'); return }
    await crear.mutateAsync(buildPayload(bodegaId))
  }

  const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
  const labelCls  = "block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5"

  // ── Panel de carrito (compartido entre tablet y móvil) ─────────────────
  const CartTotals = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Descuento</span>
        <div className="relative w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#5F6B7A] font-bold pointer-events-none">L</span>
          <input type="number" min="0" step="0.01"
            value={descuento || ''} onChange={e => setDescuento(Number(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#5F6B7A]">ISV ({empresaConfig?.isv_rate ?? 15}%)</span>
        <button type="button" onClick={() => setAplicarISV(v => !v)}
          style={{ height: '22px', width: '40px' }}
          className={`rounded-full transition-all flex items-center px-0.5 ${aplicarISV ? 'bg-[#0E78D8]' : 'bg-gray-200'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${aplicarISV ? 'translate-x-[18px]' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex justify-between text-sm text-[#5F6B7A]">
          <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {descuento > 0 && (
          <div className="flex justify-between text-sm text-[#5F6B7A]">
            <span>Descuento</span><span className="font-medium text-red-500">− {formatCurrency(descuento)}</span>
          </div>
        )}
        {aplicarISV && (
          <div className="flex justify-between text-sm text-[#5F6B7A]">
            <span>ISV ({empresaConfig?.isv_rate ?? 15}%)</span>
            <span className="font-medium">{formatCurrency(isv)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-4 py-3.5 rounded-xl text-white font-bold"
        style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 60%, #38D6D4 100%)' }}>
        <span className="text-sm">TOTAL</span>
        <span className="text-lg tracking-tight">{formatCurrency(total)}</span>
      </div>


      {esRestaurante && (
        <div>
          <label className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5 block">
            <span className="flex items-center gap-1"><TableProperties size={11} /> Mesa / Cliente</span>
          </label>
          <input
            type="text"
            value={mesa}
            onChange={e => setMesa(e.target.value)}
            placeholder="Mesa 3, Juan..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
          />
        </div>
      )}

      <div className="space-y-2 pt-1">
        {esRestaurante ? (
          <>
            <Button
              type="button"
              loading={enviarCocina.isPending}
              icon={<UtensilsCrossed size={15} />}
              disabled={lineas.length === 0 || !bodegaId || sinSesion}
              onClick={() => { setError(''); enviarCocina.mutate() }}
              className="w-full justify-center"
              style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 100%)' }}
            >
              Enviar a cocina
            </Button>
            <Button type="submit" loading={crear.isPending} icon={<Receipt size={15} />}
              variant="secondary"
              disabled={lineas.length === 0 || sinSesion} className="w-full justify-center">
              Facturar directo
            </Button>
          </>
        ) : (
          <Button type="submit" loading={crear.isPending} icon={<Receipt size={15} />}
            disabled={lineas.length === 0 || sinSesion} className="w-full justify-center">
            Registrar venta
          </Button>
        )}
        <button type="button" onClick={resetForm}
          className="w-full py-1.5 rounded-lg text-xs text-[#5F6B7A] hover:text-red-500 hover:bg-red-50 transition-colors font-medium text-center">
          Limpiar formulario
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* Modal de stock insuficiente */}
      <Modal open={stockModal.open} onClose={() => setStockModal(s => ({ ...s, open: false }))}
        title="Stock insuficiente" size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 whitespace-pre-line leading-relaxed">{stockModal.mensaje}</p>
          </div>
          {stockModal.alternativas.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">
                Stock disponible en otras bodegas:
              </p>
              {stockModal.alternativas.map(b => (
                <button key={b.id} type="button" onClick={() => cambiarBodega(b.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-[#072B5A] font-medium hover:bg-[#0E78D8] hover:text-white hover:border-[#0E78D8] transition-colors text-left">
                  <Warehouse size={15} className="shrink-0" /> Cambiar a "{b.nombre}"
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#5F6B7A]">No hay otras bodegas con stock suficiente para esta venta.</p>
          )}
          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={() => setStockModal(s => ({ ...s, open: false }))}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>


      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Nueva Venta</h1>
        <p className="text-sm text-[#5F6B7A]">Registra una factura de venta</p>
      </div>

      {sinSesion && (
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={18} className="shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">No hay una sesión de caja abierta</p>
              <p className="text-xs text-amber-700 mt-0.5">Debes abrir una sesión antes de registrar ventas.</p>
            </div>
          </div>
          <button onClick={() => navigate('/caja')}
            className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors">
            Abrir sesión
          </button>
        </div>
      )}


      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Cabecera: siempre visible ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

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

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Banknote size={11} /> Método de pago</span>
              </label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as typeof metodoPago)} className={selectCls}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── TABLET POS: restaurante + md+ ─────────────────────────── */}
        {esRestaurante && (
          <div className="hidden md:flex gap-4" style={{ height: 'calc(100vh - 250px)', minHeight: 520 }}>

            {/* Grilla de ítems */}
            <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Tabs + buscador */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: 'todos' as const,    label: 'Todos',      icon: <LayoutGrid size={13} /> },
                    { key: 'platos' as const,   label: 'Platos',     icon: <ChefHat size={13} />   },
                    { key: 'productos' as const, label: 'Productos',  icon: <Package size={13} />   },
                  ]).map(tab => (
                    <button key={tab.key} type="button"
                      onClick={() => setCategoriaActiva(tab.key)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        categoriaActiva === tab.key
                          ? 'bg-[#0E78D8] text-white shadow-sm'
                          : 'text-[#5F6B7A] hover:bg-[#F4F7FA]'
                      }`}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}

                  <div className="flex-1" />

                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F7FA] border border-gray-200 rounded-lg w-44">
                    <Search size={13} className="text-[#5F6B7A] shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={tabletSearch}
                      onChange={e => setTabletSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-[#072B5A] placeholder-gray-400 focus:outline-none min-w-0"
                    />
                    {tabletSearch && (
                      <button type="button" onClick={() => setTabletSearch('')} className="text-gray-400">
                        <XCircle size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {gridRecetas.length === 0 && gridProductos.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-[#5F6B7A]">Sin ítems en esta categoría</p>
                  </div>
                )}

                {gridRecetas.length > 0 && (
                  <div>
                    {categoriaActiva === 'todos' && (
                      <p className="text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <ChefHat size={10} /> Platos / Recetas
                      </p>
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {gridRecetas.map(r => {
                        const qty = getQtyReceta(r.id)
                        return (
                          <button key={r.id} type="button" onClick={() => addReceta(r)}
                            className={`relative text-left p-3.5 rounded-xl border transition-all active:scale-95 select-none ${
                              qty > 0
                                ? 'border-[#0E78D8] bg-[#0E78D8]/5 shadow-sm'
                                : 'border-gray-100 bg-white hover:border-[#0E78D8]/40 hover:bg-[#F4F7FA]'
                            }`}>
                            <div className="w-9 h-9 rounded-lg bg-[#0E78D8]/10 border border-[#0E78D8]/20 flex items-center justify-center mb-2">
                              <ChefHat size={16} className="text-[#0E78D8]" />
                            </div>
                            <p className="text-sm font-semibold text-[#072B5A] leading-tight line-clamp-2">{r.nombre}</p>
                            <p className="text-sm font-bold text-[#0E78D8] mt-1.5">{formatCurrency(r.precio_venta)}</p>
                            {qty > 0 && (
                              <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 bg-[#0E78D8] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {qty}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {gridProductos.length > 0 && (
                  <div>
                    {categoriaActiva === 'todos' && gridRecetas.length > 0 && (
                      <p className="text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Package size={10} /> Productos
                      </p>
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {gridProductos.map(p => {
                        const qty = getQtyProducto(p.id)
                        return (
                          <button key={p.id} type="button" onClick={() => addProduct(p)}
                            className={`relative text-left p-3.5 rounded-xl border transition-all active:scale-95 select-none ${
                              qty > 0
                                ? 'border-[#0E78D8] bg-[#0E78D8]/5 shadow-sm'
                                : 'border-gray-100 bg-white hover:border-[#0E78D8]/40 hover:bg-[#F4F7FA]'
                            }`}>
                            {p.imagen_url
                              ? <img src={p.imagen_url} className="w-9 h-9 rounded-lg object-cover border border-gray-100 mb-2" alt="" />
                              : <div className="w-9 h-9 rounded-lg bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-2">
                                  <Package size={16} className="text-gray-300" />
                                </div>
                            }
                            <p className="text-sm font-semibold text-[#072B5A] leading-tight line-clamp-2">{p.nombre}</p>
                            <p className="text-sm font-bold text-[#0E78D8] mt-1.5">{formatCurrency(p.precio_venta)}</p>
                            {qty > 0 && (
                              <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 bg-[#0E78D8] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {qty}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de orden / carrito */}
            <div className="w-72 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden shrink-0">

              {/* Header carrito */}
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#072B5A]">Pedido actual</p>
                  {totalItems > 0 && (
                    <span className="text-xs font-bold text-[#0E78D8] bg-[#0E78D8]/10 px-2 py-0.5 rounded-full">
                      {totalItems} ítem{totalItems !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Líneas scrollables */}
              <div className="flex-1 overflow-y-auto">
                {lineas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                    <div className="w-12 h-12 rounded-xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-2">
                      <Receipt size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-[#5F6B7A] font-medium">Pedido vacío</p>
                    <p className="text-xs text-gray-400 mt-1">Toca un ítem para agregar</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {lineas.map((l, i) => (
                      <div key={l._key} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {l.tipo === 'receta'
                              ? <div className="w-7 h-7 rounded-lg bg-[#0E78D8]/10 border border-[#0E78D8]/20 shrink-0 flex items-center justify-center">
                                  <ChefHat size={12} className="text-[#0E78D8]" />
                                </div>
                              : <div className="w-7 h-7 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                                  {l.producto?.imagen_url
                                    ? <img src={l.producto.imagen_url} className="w-full h-full object-cover" alt="" />
                                    : <Package size={12} className="text-gray-300" />
                                  }
                                </div>
                            }
                            <p className="text-xs font-semibold text-[#072B5A] leading-tight truncate">
                              {l.tipo === 'receta' ? l.receta!.nombre : l.producto!.nombre}
                            </p>
                          </div>
                          <button type="button" onClick={() => removeLinea(i)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-0.5">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateCantidad(i, -1)}
                              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] active:scale-95 transition-all">
                              <Minus size={11} />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-[#072B5A]">{l.cantidad}</span>
                            <button type="button" onClick={() => updateCantidad(i, +1)}
                              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] active:scale-95 transition-all">
                              <Plus size={11} />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-[#072B5A]">{formatCurrency(l.cantidad * l.precio_unitario)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totales + cobrar */}
              <div className="border-t border-gray-100 p-4 shrink-0">
                <CartTotals compact />
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA ESTÁNDAR: mobile siempre; desktop solo si NO es restaurante ── */}
        <div className={`flex flex-col sm:flex-row gap-4 items-start${esRestaurante ? ' md:hidden' : ''}`}>

          {/* Tabla de detalle */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">

            {/* Buscador */}
            <div className="p-4 border-b border-gray-100" ref={searchRef}>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F4F7FA] border border-gray-200 rounded-xl focus-within:border-[#0E78D8] focus-within:ring-2 focus-within:ring-[#0E78D8]/20 transition-all">
                  <Search size={16} className="text-[#5F6B7A] shrink-0" />
                  <input
                    type="text"
                    placeholder={esRestaurante ? 'Buscar plato o ingrediente…' : 'Buscar producto por nombre o código...'}
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

                {showDrop2 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                    {filteredRecetas.length > 0 && (
                      <>
                        <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider flex items-center gap-1"><ChefHat size={10} /> Platos / Recetas</p>
                        {filteredRecetas.map(r => (
                          <button key={r.id} type="button" onClick={() => addReceta(r)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F4F7FA] transition-colors text-left group">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#0E78D8]/10 border border-[#0E78D8]/20 shrink-0 flex items-center justify-center">
                                <ChefHat size={14} className="text-[#0E78D8]" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#072B5A] group-hover:text-[#0E78D8] transition-colors">{r.nombre}</p>
                                <p className="text-xs text-gray-400">{r.ingredientes.length} ingredientes</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-[#0E78D8]">{formatCurrency(r.precio_venta)}</span>
                              <span className="w-6 h-6 bg-[#0E78D8] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={13} /></span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {filteredProducts.length > 0 && (
                      <>
                        {filteredRecetas.length > 0 && <div className="border-t border-gray-100 mt-1" />}
                        {esRestaurante && <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider">Productos</p>}
                        {filteredProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => addProduct(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F4F7FA] transition-colors text-left group">
                            <div className="flex items-center gap-3">
                              {p.imagen_url
                                ? <img src={p.imagen_url} className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" alt="" />
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
                              <span className="w-6 h-6 bg-[#0E78D8] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={13} /></span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {showDrop && search.length > 0 && !showDrop2 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl px-4 py-3 text-sm text-[#5F6B7A]">
                    No se encontraron resultados para "<strong>{search}</strong>"
                  </div>
                )}
              </div>
            </div>

            {/* Encabezado tabla */}
            <div className="overflow-x-auto">
            {lineas.length > 0 && (
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F4F7FA]/70 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider border-b border-gray-100 min-w-[420px]">
                <div className="col-span-4">{esRestaurante ? 'Plato / Producto' : 'Producto'}</div>
                <div className="col-span-3 text-center">Cantidad</div>
                <div className="col-span-2 text-right">Precio unit.</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>
            )}

            {lineas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
                  <Receipt size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-[#5F6B7A]">{esRestaurante ? 'Sin platos aún' : 'Sin productos aún'}</p>
                <p className="text-xs text-gray-400 mt-1">Usa el buscador de arriba para {esRestaurante ? 'agregar platos o productos' : 'agregar productos'}</p>
              </div>
            )}

            {lineas.map((l, i) => (
              <div key={l._key}
                className={`grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-gray-50 last:border-0 min-w-[420px] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FA]/25'} hover:bg-[#F4F7FA]/60 transition-colors`}>

                <div className="col-span-4 flex items-center gap-2.5">
                  {l.tipo === 'receta'
                    ? <div className="w-9 h-9 rounded-lg bg-[#0E78D8]/10 border border-[#0E78D8]/20 shrink-0 flex items-center justify-center">
                        <ChefHat size={16} className="text-[#0E78D8]" />
                      </div>
                    : (l.producto?.imagen_url
                        ? <img src={l.producto.imagen_url} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" alt="" />
                        : <div className="w-9 h-9 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0" />)
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#072B5A] leading-tight truncate">
                      {l.tipo === 'receta' ? l.receta!.nombre : l.producto!.nombre}
                    </p>
                    {l.tipo === 'producto' && l.producto?.codigo && (
                      <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>
                    )}
                    {l.tipo === 'receta' && (
                      <p className="text-xs text-[#0E78D8]">{l.receta!.ingredientes.length} ingredientes</p>
                    )}
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
          </div>

          {/* Panel de totales */}
          <div className="w-full sm:w-64 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-[#072B5A] uppercase tracking-wider mb-4">Resumen</p>
            <CartTotals />
          </div>
        </div>

      </form>
    </div>
  )
}
