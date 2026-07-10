import { useState, useRef, useEffect } from 'react'
import { ArrowRightCircle, CheckCircle, XCircle, Send, RotateCcw, Download, Loader2,
         Pencil, Plus, Minus, Trash2, Search, Banknote } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { cotizacionesApi, bodegasApi, clientesApi, productosApi, empresaApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, getAxiosError, todayISO } from '@/lib/utils'
import type { Cotizacion, EstadoCotizacion, Producto } from '@/types'

/* ── Badge de estado ─────────────────────────────────────────── */
const estadoConfig: Record<EstadoCotizacion, { label: string; cls: string }> = {
  borrador:   { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
  enviada:    { label: 'Enviada',     cls: 'bg-blue-50 text-blue-700' },
  aprobada:   { label: 'Aprobada',   cls: 'bg-emerald-50 text-emerald-700' },
  rechazada:  { label: 'Rechazada',  cls: 'bg-red-50 text-red-700' },
  convertida: { label: 'Convertida', cls: 'bg-purple-50 text-purple-700' },
  vencida:    { label: 'Vencida',    cls: 'bg-amber-50 text-amber-700' },
}

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  const { label, cls } = estadoConfig[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

const acciones: Record<string, { estado: string; label: string; icon: React.ReactNode; variant?: 'danger' | 'secondary' }[]> = {
  borrador: [{ estado: 'enviada',   label: 'Marcar enviada', icon: <Send size={13} /> }],
  enviada:  [
    { estado: 'aprobada',  label: 'Aprobar',  icon: <CheckCircle size={13} /> },
    { estado: 'rechazada', label: 'Rechazar', icon: <XCircle size={13} />,    variant: 'danger' },
    { estado: 'borrador',  label: 'Revertir', icon: <RotateCcw size={13} />,  variant: 'secondary' },
  ],
  aprobada: [{ estado: 'rechazada', label: 'Rechazar', icon: <XCircle size={13} />, variant: 'danger' }],
}

interface LineaCotEdit {
  producto_id: number
  nombre: string
  codigo?: string | null
  imagen_url?: string | null
  cantidad: number
  precio_unitario: number
}

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'

const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
const labelCls  = "block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5"

export default function HistorialCotizacionesPage() {
  const { state } = useAuth()
  const empresaId     = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [loadingPdf, setLoadingPdf] = useState<number | null>(null)
  const [pdfError, setPdfError]     = useState('')

  /* ── Modal cambiar estado ── */
  const [estadoModal, setEstadoModal] = useState<{ cot: Cotizacion; nuevoEstado: string; label: string } | null>(null)
  const [estadoError, setEstadoError] = useState('')

  /* ── Modal convertir ── */
  const [convertirCot, setConvertirCot]     = useState<Cotizacion | null>(null)
  const [bodegaId, setBodegaId]             = useState('')
  const [metodoPago, setMetodoPago]         = useState<MetodoPago>('efectivo')
  const [convertirError, setConvertirError] = useState('')

  /* ── Modal editar borrador ── */
  const [editCot, setEditCot]               = useState<Cotizacion | null>(null)
  const [editLoading, setEditLoading]       = useState(false)
  const [editError, setEditError]           = useState('')
  const [editClienteId, setEditClienteId]   = useState('')
  const [editFecha, setEditFecha]           = useState('')
  const [editVencimiento, setEditVencimiento] = useState('')
  const [editObservaciones, setEditObservaciones] = useState('')
  const [editDescuento, setEditDescuento]   = useState(0)
  const [editAplicarISV, setEditAplicarISV] = useState(true)
  const [editLineas, setEditLineas]         = useState<LineaCotEdit[]>([])
  const [editSearch, setEditSearch]         = useState('')
  const [editShowDrop, setEditShowDrop]     = useState(false)
  const editSearchRef = useRef<HTMLDivElement>(null)

  /* ── Queries ── */
  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', empresaId, page, search],
    queryFn:  () => cotizacionesApi.list({ empresa_id: empresaId, page, per_page: 15, search: search || undefined }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes-all', empresaId],
    queryFn:  () => clientesApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: productos } = useQuery({
    queryKey: ['productos-all', empresaId],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, per_page: 500, solo_activos: true }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 5 * 60_000,
  })

  /* ── Cierra dropdown al click fuera ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (editSearchRef.current && !editSearchRef.current.contains(e.target as Node))
        setEditShowDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  /* ── Mutations ── */
  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => cotizacionesApi.cambiarEstado(id, estado),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cotizaciones'] }); setEstadoModal(null); setEstadoError('') },
    onError: (err) => setEstadoError(getAxiosError(err)),
  })

  const convertir = useMutation({
    mutationFn: ({ id, bodega_id, metodo_pago }: { id: number; bodega_id: number; metodo_pago: MetodoPago }) =>
      cotizacionesApi.convertir(id, { bodega_id, fecha_venta: todayISO(), metodo_pago }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      setConvertirCot(null); setBodegaId(''); setMetodoPago('efectivo'); setConvertirError('')
    },
    onError: (err) => setConvertirError(getAxiosError(err)),
  })

  const actualizarCot = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => cotizacionesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cotizaciones'] }); setEditCot(null); setEditError('') },
    onError: (err) => setEditError(getAxiosError(err)),
  })

  /* ── Abrir editar ── */
  const openEdit = async (cot: Cotizacion) => {
    setEditLoading(true)
    setEditError('')
    try {
      const res = await cotizacionesApi.get(cot.id)
      const full = res.data.data
      setEditCot(full)
      setEditClienteId(full.cliente?.id ? String(full.cliente.id) : '')
      setEditFecha(full.fecha_cotizacion ?? todayISO())
      setEditVencimiento(full.fecha_vencimiento ?? '')
      setEditObservaciones(full.observaciones ?? '')
      setEditDescuento(full.descuento ?? 0)
      setEditAplicarISV((full.impuesto ?? 0) > 0)
      setEditLineas(
        (full.detalles ?? []).map((d: { producto_id: number; cantidad: number; precio_unitario: number; producto?: { id: number; nombre: string; codigo?: string | null } | null }) => ({
          producto_id:     d.producto_id,
          nombre:          d.producto?.nombre ?? `Producto #${d.producto_id}`,
          codigo:          d.producto?.codigo ?? null,
          imagen_url:      null,
          cantidad:        d.cantidad,
          precio_unitario: d.precio_unitario,
        }))
      )
      setEditSearch('')
      setEditShowDrop(false)
    } catch (err) {
      setEditError(getAxiosError(err))
    } finally {
      setEditLoading(false)
    }
  }

  /* ── Cálculos edit modal ── */
  const editSubtotal = editLineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const isvRate      = (empresaConfig?.isv_rate ?? 15) / 100
  const editIsv      = editAplicarISV && editSubtotal > 0
    ? (editSubtotal - editDescuento) * isvRate
    : 0
  const editTotal    = editSubtotal - editDescuento + editIsv

  /* ── Búsqueda productos en edición ── */
  const editFilteredProds = (productos ?? []).filter(p =>
    editSearch.length > 0 &&
    (p.nombre.toLowerCase().includes(editSearch.toLowerCase()) ||
     (p.codigo ?? '').toLowerCase().includes(editSearch.toLowerCase()))
  ).slice(0, 8)

  const addEditProduct = (p: Producto) => {
    setEditLineas(prev => {
      const idx = prev.findIndex(l => l.producto_id === p.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...prev, { producto_id: p.id, nombre: p.nombre, codigo: p.codigo ?? null, imagen_url: p.imagen_url ?? null, cantidad: 1, precio_unitario: Number(p.precio_venta) }]
    })
    setEditSearch(''); setEditShowDrop(false)
  }

  const updateEditCantidad = (idx: number, delta: number) =>
    setEditLineas(prev => prev.map((l, i) => i !== idx ? l : { ...l, cantidad: Math.max(1, l.cantidad + delta) }))

  const updateEditPrecio = (idx: number, value: string) =>
    setEditLineas(prev => prev.map((l, i) => i === idx ? { ...l, precio_unitario: Number(value) || 0 } : l))

  const removeEditLinea = (idx: number) => setEditLineas(prev => prev.filter((_, i) => i !== idx))

  const handleEditSubmit = async () => {
    setEditError('')
    if (editLineas.length === 0) { setEditError('Agrega al menos un producto.'); return }
    if (!editCot) return
    await actualizarCot.mutateAsync({
      id: editCot.id,
      data: {
        cliente_id:        editClienteId ? Number(editClienteId) : null,
        fecha_cotizacion:  editFecha,
        fecha_vencimiento: editVencimiento || null,
        observaciones:     editObservaciones || null,
        descuento:         editDescuento,
        impuesto:          Math.round(editIsv * 10000) / 10000,
        detalles: editLineas.map(l => ({
          producto_id:     l.producto_id,
          cantidad:        l.cantidad,
          precio_unitario: l.precio_unitario,
        })),
      },
    })
  }

  /* ── PDF ── */
  const handlePdf = async (cot: Cotizacion) => {
    setPdfError('')
    setLoadingPdf(cot.id)
    try {
      const [cotRes, empresaRes, logoRes, { printCotizacion }] = await Promise.all([
        cotizacionesApi.get(cot.id),
        empresaApi.get(empresaId),
        empresaApi.logoBase64(empresaId),
        import('@/lib/printCotizacion'),
      ])
      printCotizacion(cotRes.data.data, empresaRes.data.data, logoRes.data.data.logo_base64 ?? undefined)
    } catch { setPdfError('No se pudo generar el documento.') }
    finally { setLoadingPdf(null) }
  }

  /* ── Columnas ── */
  const columns: Column<Cotizacion>[] = [
    {
      key: 'numero_cotizacion', header: 'N° Cotización',
      cell: r => <span className="font-mono text-sm font-bold text-[#0E78D8]">{r.numero_cotizacion}</span>,
      width: '130px',
    },
    {
      key: 'cliente', header: 'Cliente',
      cell: r => <span className="font-semibold text-[#072B5A]">{r.cliente?.nombre ?? '— Sin cliente —'}</span>,
    },
    {
      key: 'fecha_cotizacion', header: 'Fecha',
      cell: r => <span className="text-[#5F6B7A]">{r.fecha_cotizacion}</span>,
      align: 'center',
    },
    {
      key: 'fecha_vencimiento', header: 'Vence',
      cell: r => r.fecha_vencimiento
        ? <span className={`text-sm ${new Date(r.fecha_vencimiento) < new Date() && r.estado !== 'convertida' ? 'text-red-500 font-medium' : 'text-[#5F6B7A]'}`}>{r.fecha_vencimiento}</span>
        : <span className="text-gray-300">—</span>,
      align: 'center',
    },
    {
      key: 'total', header: 'Total',
      cell: r => <span className="font-bold text-[#072B5A]">{formatCurrency(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => <EstadoBadge estado={r.estado} />,
      align: 'center', width: '110px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '240px',
      cell: r => (
        <div className="flex items-center justify-end gap-1 flex-wrap">

          <button onClick={() => handlePdf(r)} disabled={loadingPdf === r.id}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Descargar PDF">
            {loadingPdf === r.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            PDF
          </button>

          {/* Editar borrador */}
          {r.estado === 'borrador' && (
            <button onClick={() => openEdit(r)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors">
              <Pencil size={13} /> Editar
            </button>
          )}

          {/* Cambios de estado */}
          {(acciones[r.estado] ?? []).map(acc => (
            <button key={acc.estado}
              onClick={() => { setEstadoModal({ cot: r, nuevoEstado: acc.estado, label: acc.label }); setEstadoError('') }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                acc.variant === 'danger'    ? 'text-red-600 hover:bg-red-50' :
                acc.variant === 'secondary' ? 'text-[#5F6B7A] hover:bg-gray-100' :
                'text-[#0E78D8] hover:bg-[#0E78D8]/8'
              }`}>
              {acc.icon}{acc.label}
            </button>
          ))}

          {/* Convertir a venta */}
          {r.estado === 'aprobada' && (
            <button onClick={() => { setConvertirCot(r); setBodegaId(''); setMetodoPago('efectivo'); setConvertirError('') }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <ArrowRightCircle size={13} /> Crear factura
            </button>
          )}

          {r.estado === 'convertida' && r.venta_id && (
            <span className="text-xs text-purple-500 font-medium">Venta #{r.venta_id}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Historial de Cotizaciones</h1>
        <p className="text-sm text-[#5F6B7A]">Gestiona y da seguimiento a tus propuestas</p>
      </div>

      {pdfError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <XCircle size={16} className="shrink-0" />{pdfError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Buscar por N° cotización..." className="max-w-sm" />
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay cotizaciones registradas." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>

      {/* ── Modal cambiar estado ── */}
      <Modal open={estadoModal !== null} onClose={() => setEstadoModal(null)} title="Cambiar estado" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Confirmar cambio de <strong>{estadoModal?.cot.numero_cotizacion}</strong> a{' '}
          <strong>{estadoConfig[estadoModal?.nuevoEstado as EstadoCotizacion]?.label ?? estadoModal?.nuevoEstado}</strong>?
        </p>
        {estadoError && <p className="mb-4 text-sm text-red-600">{estadoError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEstadoModal(null)}>Cancelar</Button>
          <Button loading={cambiarEstado.isPending}
            variant={estadoModal?.nuevoEstado === 'rechazada' ? 'danger' : 'primary'}
            onClick={() => estadoModal && cambiarEstado.mutate({ id: estadoModal.cot.id, estado: estadoModal.nuevoEstado })}>
            {estadoModal?.label}
          </Button>
        </div>
      </Modal>

      {/* ── Modal convertir a venta ── */}
      <Modal open={convertirCot !== null} onClose={() => setConvertirCot(null)} title="Convertir a venta" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          Se creará una venta desde <strong>{convertirCot?.numero_cotizacion}</strong> y se descontará el stock.
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className={labelCls}>Bodega de despacho *</label>
            <select value={bodegaId} onChange={e => setBodegaId(e.target.value)} className={selectCls}>
              <option value="">Seleccionar bodega</option>
              {bodegas?.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}><span className="flex items-center gap-1.5"><Banknote size={11} /> Método de pago</span></label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPago)} className={selectCls}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        </div>
        {convertirError && <p className="mb-4 text-sm text-red-600">{convertirError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConvertirCot(null)}>Cancelar</Button>
          <Button loading={convertir.isPending} disabled={!bodegaId} icon={<ArrowRightCircle size={15} />}
            onClick={() => convertirCot && convertir.mutate({ id: convertirCot.id, bodega_id: Number(bodegaId), metodo_pago: metodoPago })}>
            Convertir a venta
          </Button>
        </div>
      </Modal>

      {/* ── Modal editar borrador ── */}
      <Modal open={editCot !== null} onClose={() => setEditCot(null)} title={`Editar ${editCot?.numero_cotizacion ?? ''}`} size="2xl">
        {editLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#0E78D8]" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* Cabecera */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Cliente</label>
                <select value={editClienteId} onChange={e => setEditClienteId(e.target.value)} className={selectCls}>
                  <option value="">— Sin cliente —</option>
                  {clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} required className={selectCls} />
              </div>
              <div>
                <label className={labelCls}>Vencimiento</label>
                <input type="date" value={editVencimiento} onChange={e => setEditVencimiento(e.target.value)} min={editFecha} className={selectCls} />
              </div>
            </div>

            {/* Cuerpo: tabla + sidebar */}
            <div className="flex gap-4 items-start">

              {/* Tabla de productos */}
              <div className="flex-1 min-w-0 bg-[#F4F7FA] rounded-xl overflow-visible">

                {/* Buscador */}
                <div className="p-3" ref={editSearchRef}>
                  <div className="relative">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg focus-within:border-[#0E78D8] focus-within:ring-2 focus-within:ring-[#0E78D8]/20 transition-all">
                      <Search size={14} className="text-[#5F6B7A] shrink-0" />
                      <input type="text" placeholder="Buscar producto..."
                        value={editSearch}
                        onChange={e => { setEditSearch(e.target.value); setEditShowDrop(true) }}
                        onFocus={() => editSearch && setEditShowDrop(true)}
                        className="flex-1 bg-transparent text-sm text-[#072B5A] placeholder-gray-400 focus:outline-none" />
                    </div>
                    {editShowDrop && editFilteredProds.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                        {editFilteredProds.map(p => (
                          <button key={p.id} type="button" onClick={() => addEditProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F4F7FA] transition-colors text-left group">
                            <div>
                              <p className="text-sm font-semibold text-[#072B5A] group-hover:text-[#0E78D8]">{p.nombre}</p>
                              {p.codigo && <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>}
                            </div>
                            <span className="text-sm font-bold text-[#0E78D8] shrink-0 ml-3">{formatCurrency(p.precio_venta)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Líneas */}
                <div className="px-3 pb-3 space-y-1 max-h-52 overflow-y-auto">
                  {editLineas.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">Usa el buscador para agregar productos</p>
                  )}
                  {editLineas.map((l, i) => (
                    <div key={l.producto_id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#072B5A] truncate">{l.nombre}</p>
                        {l.codigo && <p className="text-xs text-gray-400 font-mono">{l.codigo}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateEditCantidad(i, -1)}
                          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all">
                          <Minus size={10} />
                        </button>
                        <input type="number" min="1" step="1" value={l.cantidad}
                          onChange={e => setEditLineas(prev => prev.map((ln, idx) => idx === i ? { ...ln, cantidad: Math.max(1, Number(e.target.value) || 1) } : ln))}
                          className="w-10 text-center rounded border border-gray-200 py-0.5 text-sm font-bold text-[#072B5A] focus:outline-none focus:border-[#0E78D8]" />
                        <button type="button" onClick={() => updateEditCantidad(i, +1)}
                          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all">
                          <Plus size={10} />
                        </button>
                      </div>
                      <input type="number" min="0" step="0.01" value={l.precio_unitario}
                        onChange={e => updateEditPrecio(i, e.target.value)}
                        className="w-24 text-right rounded border border-gray-200 px-2 py-0.5 text-sm text-[#072B5A] focus:outline-none focus:border-[#0E78D8]" />
                      <span className="w-20 text-right text-sm font-bold text-[#072B5A] shrink-0">
                        {formatCurrency(l.cantidad * l.precio_unitario)}
                      </span>
                      <button type="button" onClick={() => removeEditLinea(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar totales */}
              <div className="w-56 shrink-0 space-y-3">

                <div>
                  <label className={labelCls}>Descuento (L)</label>
                  <input type="number" min="0" step="0.01"
                    value={editDescuento || ''} onChange={e => setEditDescuento(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full text-right rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#5F6B7A]">ISV ({empresaConfig?.isv_rate ?? 15}%)</span>
                  <button type="button" onClick={() => setEditAplicarISV(v => !v)}
                    style={{ height: '22px', width: '40px' }}
                    className={`rounded-full transition-all flex items-center px-0.5 ${editAplicarISV ? 'bg-[#0E78D8]' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editAplicarISV ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm text-[#5F6B7A]">
                    <span>Subtotal</span><span className="font-medium">{formatCurrency(editSubtotal)}</span>
                  </div>
                  {editDescuento > 0 && (
                    <div className="flex justify-between text-sm text-[#5F6B7A]">
                      <span>Descuento</span><span className="font-medium text-red-500">− {formatCurrency(editDescuento)}</span>
                    </div>
                  )}
                  {editAplicarISV && (
                    <div className="flex justify-between text-sm text-[#5F6B7A]">
                      <span>ISV</span><span className="font-medium">{formatCurrency(editIsv)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center px-3 py-2.5 rounded-xl text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 100%)' }}>
                  <span>TOTAL</span>
                  <span>{formatCurrency(editTotal)}</span>
                </div>

                <div>
                  <label className={labelCls}>Observaciones</label>
                  <textarea rows={3} value={editObservaciones} onChange={e => setEditObservaciones(e.target.value)}
                    placeholder="Notas, condiciones..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] resize-none focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all placeholder-gray-400" />
                </div>
              </div>
            </div>

            {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{editError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setEditCot(null)}>Cancelar</Button>
              <Button loading={actualizarCot.isPending} onClick={handleEditSubmit}>
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
