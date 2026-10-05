import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ComboBox from '@/components/ui/ComboBox'
import { Plus, XCircle, Search, Minus, Trash2, ClipboardList, CalendarDays, Hash,
         CheckCircle2, Lock, AlignLeft, PenLine, UserRound } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { requisicionesApi, proveedoresApi, productosApi, empresaApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import CantidadInput from '@/components/ui/CantidadInput'
import { getAxiosError, todayISO, imgUrl, formatCurrency } from '@/lib/utils'
import type { Requisicion, Producto } from '@/types'
import { printRequisicion } from '@/lib/printRequisicion'

// producto = null → artículo libre (código y descripción escritos a mano)
// precio = como lo escribe el usuario (con o sin ISV según el switch); tasa = ISV del producto
interface LineaReq {
  key: string
  producto: Pick<Producto, 'id' | 'nombre' | 'codigo' | 'imagen_url'> | null
  codigo: string
  descripcion: string
  cantidad: number
  precio: number
  tasa: number | null
}

let lineaSeq = 0
const nuevaKey = () => `r${++lineaSeq}`

const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[var(--cs)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] transition-all"
const labelCls = "block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5"

export default function RequisicionPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const navigate = useNavigate()
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')
  const [proveedorId, setProveedorId]   = useState('')
  const [fecha, setFecha]               = useState(todayISO())
  const [realizadoPor, setRealizadoPor] = useState(state.usuario?.nombre ?? '')
  const [observaciones, setObservaciones] = useState('')
  const [condicion, setCondicion]       = useState<'credito' | 'contado'>('contado')
  const [incluyeIsv, setIncluyeIsv]     = useState(true)
  const [lineas, setLineas]             = useState<LineaReq[]>([])

  const [search, setSearch]     = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { data: proveedores } = useQuery({ queryKey: ['proveedores-all', empresaId], queryFn: () => proveedoresApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 5 * 60_000,
  })
  const { data: productos }   = useQuery({ queryKey: ['productos-all', empresaId],   queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data), enabled: empresaId > 0 })

  const { data: numData, refetch: refetchNum } = useQuery({
    queryKey: ['req-siguiente-num', empresaId],
    queryFn:  () => requisicionesApi.siguienteNumero(empresaId).then(r => r.data.data.numero_requisicion),
    enabled:  empresaId > 0 && !editId,
  })

  /* ── Edición: cargar la requisición ─────────────────────────── */
  const { data: editando } = useQuery({
    queryKey: ['requisicion', editId],
    queryFn:  () => requisicionesApi.get(editId!).then(r => r.data.data),
    enabled:  !!editId,
  })
  useEffect(() => {
    if (!editando) return
    setProveedorId(editando.proveedor_id ? String(editando.proveedor_id) : '')
    setFecha(editando.fecha_requisicion)
    setRealizadoPor(editando.realizado_por ?? '')
    setObservaciones(editando.observaciones ?? '')
    setCondicion(editando.condicion ?? 'contado')
    setIncluyeIsv(false) // se guardan precios sin ISV
    setLineas((editando.detalles ?? []).map(d => ({
      key: nuevaKey(),
      producto: d.producto_id ? { id: d.producto_id, nombre: d.descripcion, codigo: d.codigo ?? undefined, imagen_url: d.imagen_url ?? undefined } : null,
      codigo: d.producto_id ? '' : (d.codigo ?? ''),
      descripcion: d.producto_id ? '' : d.descripcion,
      cantidad: d.cantidad,
      precio: d.precio_unitario,
      tasa: d.tasa_isv,
    })))
  }, [editando])

  const numero = editId ? (editando?.numero_requisicion ?? '') : (numData ?? '')

  const imprimir = async (req: Requisicion) => {
    try {
      const [empresaRes, logoRes] = await Promise.all([empresaApi.get(empresaId), empresaApi.logoBase64(empresaId)])
      await printRequisicion(req, empresaRes.data.data, logoRes.data.data.logo_base64 ?? undefined)
    } catch { /* la impresión es opcional */ }
  }

  const guardar = useMutation({
    mutationFn: (payload: unknown) => editId ? requisicionesApi.update(editId, payload) : requisicionesApi.create(payload),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ['requisiciones'] })
      const req = (res.data as { data: Requisicion }).data
      if (editId) {
        qc.invalidateQueries({ queryKey: ['requisicion', editId] })
        navigate('/requisiciones/historial')
      } else {
        resetForm(); refetchNum()
        setSuccess(`Requisición ${req.numero_requisicion} guardada correctamente.`)
        setTimeout(() => setSuccess(''), 6000)
      }
      await imprimir(req)
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

  /* ── Totales: precio base (sin ISV) por línea + ISV según la tasa del producto ── */
  const tasaDe = (l: LineaReq) => (l.tasa ?? empresaConfig?.isv_rate ?? 15) / 100
  const precioBase = (l: LineaReq) => incluyeIsv ? l.precio / (1 + tasaDe(l)) : l.precio
  const subtotal = lineas.reduce((s, l) => s + l.cantidad * precioBase(l), 0)
  const isv      = lineas.reduce((s, l) => s + l.cantidad * precioBase(l) * tasaDe(l), 0)
  const total    = subtotal + isv
  const r4 = (n: number) => Math.round(n * 10000) / 10000

  const resetForm = () => {
    setProveedorId(''); setFecha(todayISO()); setRealizadoPor(state.usuario?.nombre ?? '')
    setObservaciones(''); setCondicion('contado'); setIncluyeIsv(true)
    setLineas([]); setSearch(''); setError('')
  }

  const addProduct = (p: Producto) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto?.id === p.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l)
      // Precio sugerido: costo del catálogo (sin ISV), ajustado si se escribe con ISV
      const tasa  = p.tasa_isv != null ? Number(p.tasa_isv) : null
      const costo = Number(p.costo ?? 0)
      const precio = incluyeIsv ? costo * (1 + (tasa ?? empresaConfig?.isv_rate ?? 15) / 100) : costo
      return [...prev, { key: nuevaKey(), producto: p, codigo: '', descripcion: '', cantidad: 1, precio: r4(precio), tasa }]
    })
    setSearch(''); setShowDrop(false)
  }

  const addArticuloLibre = (descripcion = '') => {
    setLineas(prev => [...prev, { key: nuevaKey(), producto: null, codigo: '', descripcion, cantidad: 1, precio: 0, tasa: null }])
    setSearch(''); setShowDrop(false)
  }

  const updateLinea = (idx: number, cambios: Partial<LineaReq>) =>
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, ...cambios } : l))

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (lineas.length === 0) { setError('Agrega al menos un artículo.'); return }
    if (lineas.some(l => !l.producto && !l.descripcion.trim())) { setError('Escribe la descripción de los artículos libres.'); return }
    await guardar.mutateAsync({
      empresa_id:        empresaId,
      proveedor_id:      proveedorId ? Number(proveedorId) : null,
      fecha_requisicion: fecha,
      realizado_por:     realizadoPor.trim() || null,
      condicion,
      observaciones:     observaciones.trim() || null,
      impuesto:          r4(isv),
      detalles: lineas.map(l => ({
        producto_id: l.producto?.id ?? null,
        codigo:      l.producto ? null : (l.codigo.trim() || null),
        descripcion: l.producto ? null : l.descripcion.trim(),
        cantidad:    l.cantidad,
        precio_unitario: r4(precioBase(l)),
      })),
    })
  }

  if (editId && editando && (editando.estado !== 'borrador' || editando.autorizado)) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-sm text-[#5F6B7A]">
        La requisición {editando.numero_requisicion} {editando.autorizado ? 'ya fue autorizada' : 'ya no está en borrador'} y no se puede editar.
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">{editId ? `Editar requisición ${numero}` : 'Nueva requisición'}</h1>
        <p className="text-sm text-[#5F6B7A]">Pedido de mercadería a un proveedor. No afecta el inventario.</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={18} className="shrink-0" />{success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Cabecera ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className={labelCls}><span className="flex items-center gap-1.5"><Hash size={11} /> N° de pedido</span></label>
              <div className="relative">
                <input readOnly value={numero}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-8 text-sm font-bold text-[var(--cp)] bg-[#F4F7FA] cursor-default select-none tracking-wide" />
                <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
              </div>
            </div>

            <div>
              <ComboBox
                label="Proveedor"
                placeholder="— Sin proveedor —"
                value={proveedorId}
                onChange={v => setProveedorId(v)}
                options={proveedores?.map(p => ({ value: p.id, label: p.nombre })) ?? []}
              />
            </div>

            <div>
              <label className={labelCls}><span className="flex items-center gap-1.5"><CalendarDays size={11} /> Fecha *</span></label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={inputCls} />
            </div>

            <div>
              <label className={labelCls}><span className="flex items-center gap-1.5"><UserRound size={11} /> Realizado por</span></label>
              <input type="text" value={realizadoPor} maxLength={150} onChange={e => setRealizadoPor(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Condición</label>
              <select value={condicion} onChange={e => setCondicion(e.target.value as 'credito' | 'contado')} className={inputCls}>
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Detalle + Resumen ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">

          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">

            {/* Buscador */}
            <div className="p-4 border-b border-gray-100 flex gap-2" ref={searchRef}>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F4F7FA] border border-gray-200 rounded-xl focus-within:border-[var(--cp)] focus-within:ring-2 focus-within:ring-[var(--cp)]/20 transition-all">
                  <Search size={16} className="text-[#5F6B7A] shrink-0" />
                  <input type="text" placeholder="Buscar producto por nombre o código..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowDrop(true) }}
                    onFocus={() => search && setShowDrop(true)}
                    className="flex-1 bg-transparent text-sm text-[var(--cs)] placeholder-gray-400 focus:outline-none" />
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
                          {imgUrl(p.imagen_url)
                            ? <img src={imgUrl(p.imagen_url)!} className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
                            : <div className="w-8 h-8 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0" />}
                          <div>
                            <p className="text-sm font-semibold text-[var(--cs)] group-hover:text-[var(--cp)] transition-colors">{p.nombre}</p>
                            {p.codigo && <p className="text-xs text-gray-400 font-mono">{p.codigo}</p>}
                          </div>
                        </div>
                        <span className="w-6 h-6 bg-[var(--cp)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Plus size={13} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {showDrop && search.length > 0 && filteredProducts.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden text-sm">
                    <p className="px-4 pt-3 pb-2 text-[#5F6B7A]">No se encontraron productos con "<strong>{search}</strong>"</p>
                    <button type="button" onClick={() => addArticuloLibre(search.trim())}
                      className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 text-[var(--cp)] font-semibold hover:bg-[#F4F7FA] transition-colors text-left">
                      <PenLine size={14} /> Agregar "{search.trim()}" como artículo libre
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => addArticuloLibre()}
                title="Agregar un artículo que no está en productos"
                className="shrink-0 flex items-center gap-1.5 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-[var(--cp)] hover:bg-[#F4F7FA] hover:border-[var(--cp)] transition-all">
                <PenLine size={14} /> <span className="hidden sm:inline">Artículo libre</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              {lineas.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F4F7FA]/70 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider border-b border-gray-100 min-w-[640px]">
                  <div className="col-span-2">Código</div>
                  <div className="col-span-3">Descripción</div>
                  <div className="col-span-3 text-center">Cantidad</div>
                  <div className="col-span-2 text-right">Precio {incluyeIsv ? '(c/ISV)' : '(s/ISV)'}</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1" />
                </div>
              )}

              {lineas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center px-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
                    <ClipboardList size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-[#5F6B7A]">Sin artículos aún</p>
                  <p className="text-xs text-gray-400 mt-1">Busca productos de tu catálogo, o usa "Artículo libre" para pedir algo que aún no tienes registrado</p>
                </div>
              )}

              {lineas.map((l, i) => (
                <div key={l.key}
                  className={`grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-gray-50 last:border-0 min-w-[640px] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FA]/25'} hover:bg-[#F4F7FA]/60 transition-colors`}>

                  {l.producto ? (
                    <>
                      <div className="col-span-2 flex items-center gap-2 min-w-0">
                        {imgUrl(l.producto.imagen_url)
                          ? <img src={imgUrl(l.producto.imagen_url)!} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                          : <div className="w-9 h-9 rounded-lg bg-[#F4F7FA] border border-gray-100 shrink-0" />}
                        <span className="text-sm font-mono font-semibold text-[var(--cs)] truncate">{l.producto.codigo || '—'}</span>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-semibold text-[var(--cs)] leading-tight truncate">{l.producto.nombre}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <input type="text" value={l.codigo} maxLength={60}
                          onChange={e => updateLinea(i, { codigo: e.target.value })}
                          placeholder="Código"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
                      </div>
                      <div className="col-span-3 min-w-0">
                        <input type="text" value={l.descripcion} maxLength={255} autoFocus={!l.descripcion}
                          onChange={e => updateLinea(i, { descripcion: e.target.value })}
                          placeholder="Descripción del artículo"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><PenLine size={9} /> Artículo libre</p>
                      </div>
                    </>
                  )}

                  <div className="col-span-3 flex items-center justify-center gap-1.5">
                    <button type="button" onClick={() => l.cantidad <= 1 ? removeLinea(i) : updateLinea(i, { cantidad: l.cantidad - 1 })}
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[var(--cp)] hover:text-[var(--cp)] transition-all">
                      <Minus size={12} />
                    </button>
                    <CantidadInput value={l.cantidad}
                      onChange={n => updateLinea(i, { cantidad: n })}
                      onRemove={() => removeLinea(i)}
                      className="w-14 text-center rounded-lg border border-gray-200 py-1.5 text-sm font-bold text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
                    <button type="button" onClick={() => updateLinea(i, { cantidad: l.cantidad + 1 })}
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-[#5F6B7A] hover:border-[var(--cp)] hover:text-[var(--cp)] transition-all">
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={l.precio || ''} placeholder="0.00"
                      onChange={e => updateLinea(i, { precio: Number(e.target.value) || 0 })}
                      className="w-full text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]" />
                  </div>

                  <div className="col-span-1 text-right">
                    <span className="text-sm font-bold text-[var(--cs)]">{formatCurrency(l.cantidad * precioBase(l))}</span>
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

          {/* Panel lateral */}
          <div className="w-full sm:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-xs font-bold text-[var(--cs)] uppercase tracking-wider">Resumen</p>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#5F6B7A]">Precios incluyen ISV</span>
                <button type="button" onClick={() => setIncluyeIsv(v => !v)}
                  style={{ height: '22px', width: '40px' }}
                  className={`rounded-full transition-all flex items-center px-0.5 ${incluyeIsv ? 'bg-[var(--cp)]' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${incluyeIsv ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-sm text-[#5F6B7A]">
                  <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-[#5F6B7A]">
                  <span>ISV</span><span className="font-medium">{formatCurrency(isv)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl text-white font-bold"
                style={{ background: 'linear-gradient(135deg, var(--cs) 0%, var(--cp) 100%)' }}>
                <span className="text-sm">TOTAL</span>
                <span className="text-lg tracking-tight">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <label className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <AlignLeft size={11} /> Observaciones
              </label>
              <textarea rows={4} value={observaciones} maxLength={1000}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Tiempo de entrega, instrucciones al proveedor..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] transition-all placeholder-gray-400" />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-2">
              <Button type="submit" loading={guardar.isPending} icon={<ClipboardList size={15} />}
                disabled={lineas.length === 0} className="w-full justify-center">
                {editId ? 'Guardar cambios' : 'Guardar requisición'}
              </Button>
              {editId ? (
                <button type="button" onClick={() => navigate('/requisiciones/historial')}
                  className="w-full py-1.5 rounded-lg text-xs text-[#5F6B7A] hover:bg-gray-100 transition-colors font-medium text-center">
                  Cancelar
                </button>
              ) : (
                <button type="button" onClick={resetForm}
                  className="w-full py-1.5 rounded-lg text-xs text-[#5F6B7A] hover:text-red-500 hover:bg-red-50 transition-colors font-medium text-center">
                  Limpiar formulario
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
