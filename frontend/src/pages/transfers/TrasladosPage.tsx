import { useState, useId, useEffect } from 'react'
import ComboBox from '@/components/ui/ComboBox'
import { Plus, Trash2, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { bodegasApi, productosApi, transferenciasApi, existenciasApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import { formatNumber, getAxiosError, todayISO } from '@/lib/utils'
import type { Producto } from '@/types'

// ── Stock por bodega para un producto ────────────────────────────────────────
function StockBodegaInfo({ productoId, empresaId, bodegaOrigenId, cantidad }: {
  productoId: string; empresaId: number; bodegaOrigenId: string; cantidad: string
}) {
  const { data: existencias = [] } = useQuery({
    queryKey: ['existencias-prod', empresaId, productoId],
    queryFn:  () => existenciasApi.list({ empresa_id: empresaId, producto_id: Number(productoId), per_page: 50 })
                    .then(r => r.data.data),
    enabled:  !!productoId && empresaId > 0,
    staleTime: 30_000,
  })

  if (!existencias.length) return (
    <p className="text-[10px] text-[#5F6B7A] mt-1">Sin stock registrado en ninguna bodega.</p>
  )

  const cantSolicitada = Number(cantidad) || 0
  const stockOrigen = existencias.find(e => String(e.bodega_id) === bodegaOrigenId)?.cantidad_disponible ?? null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {existencias.map(e => {
          const esOrigen = String(e.bodega_id) === bodegaOrigenId
          const nombre   = e.bodega?.nombre ?? `Bodega ${e.bodega_id}`
          return (
            <span key={e.id} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              esOrigen
                ? 'bg-[#0E78D8]/10 text-[#0E78D8] border-[#0E78D8]/30'
                : 'bg-gray-100 text-[#5F6B7A] border-gray-200'
            }`}>
              {esOrigen && <span className="w-1.5 h-1.5 rounded-full bg-[#0E78D8] shrink-0" />}
              {nombre}: {formatNumber(e.cantidad_disponible, 0)} uds
            </span>
          )
        })}
      </div>
      {bodegaOrigenId && stockOrigen !== null && cantSolicitada > 0 && cantSolicitada > stockOrigen && (
        <p className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
          <AlertTriangle size={11} /> Cantidad supera el stock disponible en origen ({formatNumber(stockOrigen, 0)} uds)
        </p>
      )}
    </div>
  )
}

interface Linea {
  _id: string
  producto_id: string
  cantidad: string
  lote: string
  fecha_vencimiento: string
  numero_serie: string
}

const emptyLinea = (id: string): Linea => ({
  _id: id, producto_id: '', cantidad: '', lote: '', fecha_vencimiento: '', numero_serie: '',
})

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]'
const labelCls = 'block text-xs font-semibold text-[#5F6B7A] mb-1'

export default function TrasladosPage() {
  const uid  = useId()
  const { state } = useAuth()
  const empresaId  = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [bodegaOrigenId,  setBodegaOrigenId]  = useState('')
  const [bodegaDestinoId, setBodegaDestinoId] = useState('')
  const [fecha,           setFecha]           = useState(todayISO())
  const [observaciones,   setObservaciones]   = useState('')
  const [lineas,          setLineas]          = useState<Linea[]>([emptyLinea(uid + '-0')])
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState('')

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })
  useEffect(() => {
    const pred = bodegas?.find(b => b.predeterminada)
    if (pred) setBodegaOrigenId(id => id || String(pred.id))
  }, [bodegas])

  const { data: productos } = useQuery({
    queryKey: ['productos-all', empresaId],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const mutation = useMutation({
    mutationFn: (payload: unknown) => transferenciasApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      setSuccess('Traslado registrado. El stock fue actualizado.')
      setBodegaOrigenId(''); setBodegaDestinoId(''); setObservaciones('')
      setLineas([emptyLinea(uid + '-reset')])
      setError('')
    },
    onError: (err) => { setError(getAxiosError(err)); setSuccess('') },
  })

  const addLinea = () =>
    setLineas(prev => [...prev, emptyLinea(uid + '-' + Date.now())])

  const removeLinea = (id: string) =>
    setLineas(prev => prev.filter(l => l._id !== id))

  const updateLinea = (id: string, field: keyof Linea, value: string) =>
    setLineas(prev => prev.map(l => l._id === id ? { ...l, [field]: value } : l))

  const getProd = (pid: string): Producto | undefined =>
    productos?.find(p => String(p.id) === pid)

  const handleSubmit = () => {
    setError(''); setSuccess('')
    if (!bodegaOrigenId)  return setError('Selecciona la bodega de origen.')
    if (!bodegaDestinoId) return setError('Selecciona la bodega de destino.')
    if (bodegaOrigenId === bodegaDestinoId) return setError('La bodega de origen y destino no pueden ser la misma.')
    if (!fecha) return setError('Ingresa la fecha del traslado.')
    const lineasValidas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0)
    if (!lineasValidas.length) return setError('Agrega al menos un producto con cantidad.')

    mutation.mutate({
      empresa_id:          empresaId,
      bodega_origen_id:    Number(bodegaOrigenId),
      bodega_destino_id:   Number(bodegaDestinoId),
      fecha_transferencia: fecha,
      observaciones:       observaciones || undefined,
      detalles: lineasValidas.map(l => ({
        producto_id:       Number(l.producto_id),
        cantidad:          Number(l.cantidad),
        lote:              l.lote || undefined,
        fecha_vencimiento: l.fecha_vencimiento || undefined,
        numero_serie:      l.numero_serie || undefined,
      })),
    })
  }

  const totalItems  = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0).length
  const totalUnidades = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0)

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Nuevo Traslado</h1>
        <p className="text-sm text-[#5F6B7A]">Mueve stock entre bodegas. El movimiento se registra de inmediato.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Panel principal ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Bodegas + fecha */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#072B5A] mb-4">Origen y destino</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <ComboBox
                label="Bodega origen *"
                placeholder="Seleccionar…"
                value={bodegaOrigenId}
                onChange={v => setBodegaOrigenId(v)}
                options={bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []}
              />

              <div className="hidden sm:flex items-center justify-center pt-5">
                <div className="flex items-center gap-1 text-[#0E78D8]">
                  <ArrowRight size={20} />
                </div>
              </div>

              <ComboBox
                label="Bodega destino *"
                placeholder="Seleccionar…"
                value={bodegaDestinoId}
                onChange={v => setBodegaDestinoId(v)}
                options={bodegas?.filter(b => String(b.id) !== bodegaOrigenId).map(b => ({ value: b.id, label: b.nombre })) ?? []}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Observaciones</label>
                <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Motivo del traslado…" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#072B5A]">Productos a trasladar</h2>
              <button onClick={addLinea}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0E78D8] hover:bg-[#0E78D8]/8 px-2.5 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> Agregar línea
              </button>
            </div>

            <div className="space-y-3">
              {lineas.map((l, idx) => {
                const prod = getProd(l.producto_id)
                const needsExtra = prod && (prod.maneja_lote || prod.maneja_vencimiento || prod.maneja_serie)
                return (
                  <div key={l._id} className="bg-[#F4F7FA] rounded-lg p-3">
                    <div className="flex gap-2 items-start">
                      <span className="text-xs text-[#5F6B7A] font-bold pt-2.5 w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                        <div>
                          <ComboBox
                            label="Producto *"
                            placeholder="Seleccionar producto…"
                            value={l.producto_id}
                            onChange={v => updateLinea(l._id, 'producto_id', v)}
                            options={productos?.map(p => ({ value: p.id, label: p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre })) ?? []}
                          />
                          {l.producto_id && (
                            <StockBodegaInfo
                              productoId={l.producto_id}
                              empresaId={empresaId}
                              bodegaOrigenId={bodegaOrigenId}
                              cantidad={l.cantidad}
                            />
                          )}
                        </div>
                        <div>
                          <label className={labelCls}>Cantidad *</label>
                          <input type="number" min="0.0001" step="any" value={l.cantidad}
                            onChange={e => updateLinea(l._id, 'cantidad', e.target.value)}
                            placeholder="0" className={inputCls} />
                        </div>
                      </div>
                      <button onClick={() => lineas.length > 1 && removeLinea(l._id)}
                        disabled={lineas.length === 1}
                        className="mt-6 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30">
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {needsExtra && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pl-7">
                        {prod.maneja_lote && (
                          <div>
                            <label className={labelCls}>Lote</label>
                            <input type="text" value={l.lote} onChange={e => updateLinea(l._id, 'lote', e.target.value)}
                              placeholder="Nro. de lote" className={inputCls} />
                          </div>
                        )}
                        {prod.maneja_vencimiento && (
                          <div>
                            <label className={labelCls}>Vencimiento</label>
                            <input type="date" value={l.fecha_vencimiento}
                              onChange={e => updateLinea(l._id, 'fecha_vencimiento', e.target.value)} className={inputCls} />
                          </div>
                        )}
                        {prod.maneja_serie && (
                          <div>
                            <label className={labelCls}>Serie</label>
                            <input type="text" value={l.numero_serie}
                              onChange={e => updateLinea(l._id, 'numero_serie', e.target.value)}
                              placeholder="Nro. de serie" className={inputCls} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Panel lateral ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6">
            <h2 className="text-sm font-bold text-[#072B5A] mb-4">Resumen</h2>

            {/* Ruta */}
            {(bodegaOrigenId || bodegaDestinoId) && (
              <div className="mb-4 p-3 bg-[#F4F7FA] rounded-lg text-xs text-[#5F6B7A] space-y-1">
                <div><span className="font-semibold">Origen:</span> {bodegas?.find(b => String(b.id) === bodegaOrigenId)?.nombre ?? '—'}</div>
                <div className="text-[#0E78D8]"><ArrowRight size={12} className="inline" /></div>
                <div><span className="font-semibold">Destino:</span> {bodegas?.find(b => String(b.id) === bodegaDestinoId)?.nombre ?? '—'}</div>
              </div>
            )}

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-[#5F6B7A]">
                <span>Líneas con producto</span>
                <span className="font-semibold text-[#072B5A]">{totalItems}</span>
              </div>
              <div className="flex justify-between text-[#5F6B7A]">
                <span>Total unidades</span>
                <span className="font-semibold text-[#072B5A]">{formatNumber(totalUnidades)}</span>
              </div>
            </div>

            {error && (
              <p className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <div className="mb-4 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircle size={14} className="shrink-0" />{success}
              </div>
            )}

            <Button
              className="w-full"
              loading={mutation.isPending}
              onClick={handleSubmit}
              disabled={!bodegaOrigenId || !bodegaDestinoId || totalItems === 0}
            >
              Registrar traslado
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
