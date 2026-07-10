import { useState } from 'react'
import { Banknote, CreditCard, ArrowLeftRight, Layers, Lock, TrendingUp,
         CheckCircle2, XCircle, RefreshCw, Clock, User, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { sesionCajaApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { SesionCaja } from '@/types'

const metodoPagoInfo = {
  efectivo:      { label: 'Efectivo',      icon: Banknote,       cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  tarjeta:       { label: 'Tarjeta',       icon: CreditCard,     cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  transferencia: { label: 'Transferencia', icon: ArrowLeftRight, cls: 'text-purple-700 bg-purple-50 border-purple-200' },
  mixto:         { label: 'Mixto',         icon: Layers,         cls: 'text-amber-700 bg-amber-50 border-amber-200' },
}

function formatDateTime(dt?: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CierreCajaPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  /* ── Estado apertura ── */
  const [montoInicial, setMontoInicial]   = useState('')
  const [abrirError, setAbrirError]       = useState('')

  /* ── Estado cierre ── */
  const [montoCierre, setMontoCierre]     = useState('')
  const [obsCI, setObsCI]                 = useState('')
  const [cerrarError, setCerrarError]     = useState('')
  const [cerrarSuccess, setCerrarSuccess] = useState('')

  /* ── Tab historial ── */
  const [tab, setTab] = useState<'actual' | 'historial'>('actual')
  const [histPage, setHistPage] = useState(1)

  /* ── Sesión actual ── */
  const { data: actualData, isLoading: loadingActual, refetch } = useQuery({
    queryKey: ['caja-actual', empresaId],
    queryFn:  () => sesionCajaApi.actual(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    refetchInterval: 60_000,
  })
  const sesion = actualData as SesionCaja | null | undefined

  /* ── Historial ── */
  const { data: histData, isLoading: loadingHist } = useQuery({
    queryKey: ['caja-historial', empresaId, histPage],
    queryFn:  () => sesionCajaApi.list({ empresa_id: empresaId, page: histPage, per_page: 10 }).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'historial',
    placeholderData: p => p,
  })

  /* ── Mutations ── */
  const abrir = useMutation({
    mutationFn: () => sesionCajaApi.abrir({ empresa_id: empresaId, monto_inicial: Number(montoInicial) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      setMontoInicial(''); setAbrirError('')
    },
    onError: (err) => setAbrirError(getAxiosError(err)),
  })

  const cerrar = useMutation({
    mutationFn: () => sesionCajaApi.cerrar(sesion!.id, {
      monto_cierre:  Number(montoCierre),
      observaciones: obsCI || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['caja-historial'] })
      const s = res.data.data
      setCerrarSuccess(`Sesión cerrada. Diferencia: ${formatCurrency(s.diferencia ?? 0)}`)
      setMontoCierre(''); setObsCI(''); setCerrarError('')
      setTimeout(() => setCerrarSuccess(''), 8000)
    },
    onError: (err) => setCerrarError(getAxiosError(err)),
  })

  const resumen = sesion?.resumen
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Cierre de Caja</h1>
          <p className="text-sm text-[#5F6B7A]">Controla las sesiones de caja y reconcilia el efectivo</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['actual', 'historial'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                tab === t ? 'bg-white text-[#072B5A] shadow-sm' : 'text-[#5F6B7A] hover:text-[#072B5A]'
              }`}>
              {t === 'actual' ? 'Sesión actual' : 'Historial'}
            </button>
          ))}
        </div>
      </div>

      {cerrarSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={18} className="shrink-0" />{cerrarSuccess}
        </div>
      )}

      {/* ── TAB SESIÓN ACTUAL ── */}
      {tab === 'actual' && (
        <div className="space-y-4">
          {loadingActual ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#0E78D8]" />
            </div>
          ) : !sesion ? (
            /* Sin sesión abierta — formulario de apertura */
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-sm mx-auto">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
                  <Lock size={24} className="text-gray-300" />
                </div>
                <p className="text-base font-bold text-[#072B5A]">No hay sesión abierta</p>
                <p className="text-sm text-[#5F6B7A] mt-1">Abre una sesión para registrar ventas del turno</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">
                    Fondo inicial (L)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5F6B7A] font-bold">L</span>
                    <input type="number" min="0" step="0.01"
                      value={montoInicial} onChange={e => setMontoInicial(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`} />
                  </div>
                </div>
                {abrirError && <p className="text-sm text-red-600">{abrirError}</p>}
                <Button loading={abrir.isPending} onClick={() => abrir.mutate()} className="w-full justify-center">
                  Abrir sesión de caja
                </Button>
              </div>
            </div>
          ) : (
            /* Sesión abierta */
            <div className="space-y-4">

              {/* Header sesión */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#072B5A]">Sesión abierta</p>
                    <p className="text-xs text-[#5F6B7A] flex items-center gap-1">
                      <Clock size={11} /> {formatDateTime(sesion.fecha_apertura)}
                      {sesion.usuario && <><User size={11} className="ml-2" /> {sesion.usuario.nombre}</>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#5F6B7A]">Fondo inicial</p>
                  <p className="text-base font-bold text-[#072B5A]">{formatCurrency(sesion.monto_inicial)}</p>
                </div>
                <button onClick={() => refetch()} className="p-2 rounded-lg text-[#5F6B7A] hover:bg-[#F4F7FA] transition-colors" title="Actualizar">
                  <RefreshCw size={15} />
                </button>
              </div>

              {/* Tarjetas por método de pago */}
              {resumen && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.entries(metodoPagoInfo) as [keyof typeof metodoPagoInfo, typeof metodoPagoInfo[keyof typeof metodoPagoInfo]][]).map(([key, info]) => {
                    const Icon = info.icon
                    const valor = resumen.por_metodo[key] ?? 0
                    return (
                      <div key={key} className={`rounded-xl border p-4 ${info.cls}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={15} />
                          <span className="text-xs font-semibold">{info.label}</span>
                        </div>
                        <p className="text-lg font-bold">{formatCurrency(valor)}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Resumen total */}
              {resumen && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-[#0E78D8]" />
                    <p className="text-sm font-bold text-[#072B5A]">Resumen del turno</p>
                    <span className="ml-auto text-xs text-[#5F6B7A]">{resumen.cantidad_ventas} venta{resumen.cantidad_ventas !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#5F6B7A]">Total ventas</span>
                        <span className="font-bold text-[#072B5A]">{formatCurrency(resumen.total_ventas)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#5F6B7A]">Fondo inicial</span>
                        <span className="font-medium text-[#072B5A]">{formatCurrency(sesion.monto_inicial)}</span>
                      </div>
                    </div>
                    <div className="pl-4 border-l border-gray-100">
                      <p className="text-xs text-[#5F6B7A] mb-1">Efectivo esperado en caja</p>
                      <p className="text-xl font-bold text-[#072B5A]">{formatCurrency(resumen.efectivo_esperado)}</p>
                      <p className="text-xs text-[#5F6B7A] mt-1">Fondo + ventas en efectivo</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario cierre */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-[#072B5A] mb-4">Cerrar sesión</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">
                      Efectivo contado en caja (L) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5F6B7A] font-bold">L</span>
                      <input type="number" min="0" step="0.01"
                        value={montoCierre} onChange={e => setMontoCierre(e.target.value)}
                        placeholder="0.00"
                        className={`${inputCls} pl-7`} />
                    </div>
                    {montoCierre && resumen && (
                      <div className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
                        Number(montoCierre) - resumen.efectivo_esperado >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {Number(montoCierre) - resumen.efectivo_esperado >= 0
                          ? <><CheckCircle2 size={14} /> Sobran {formatCurrency(Number(montoCierre) - resumen.efectivo_esperado)}</>
                          : <><AlertTriangle size={14} /> Faltan {formatCurrency(resumen.efectivo_esperado - Number(montoCierre))}</>
                        }
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">
                      Observaciones
                    </label>
                    <textarea rows={3} value={obsCI} onChange={e => setObsCI(e.target.value)}
                      placeholder="Notas del cierre..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] resize-none focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all placeholder-gray-400" />
                  </div>
                </div>

                {cerrarError && <p className="mt-3 text-sm text-red-600">{cerrarError}</p>}

                <div className="flex justify-end mt-4">
                  <Button
                    variant="danger"
                    loading={cerrar.isPending}
                    disabled={!montoCierre}
                    onClick={() => cerrar.mutate()}>
                    Cerrar sesión de caja
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingHist ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={22} className="animate-spin text-[#0E78D8]" />
            </div>
          ) : !histData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-medium text-[#5F6B7A]">No hay sesiones cerradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(histData.data as SesionCaja[]).map(s => {
                const diff = s.diferencia ?? 0
                return (
                  <div key={s.id} className="p-4 hover:bg-[#F4F7FA]/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            s.estado === 'abierta' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                          </span>
                          {s.usuario && <span className="text-xs text-[#5F6B7A]">{s.usuario.nombre}</span>}
                        </div>
                        <p className="text-xs text-[#5F6B7A]">
                          {formatDateTime(s.fecha_apertura)}
                          {s.fecha_cierre && <> → {formatDateTime(s.fecha_cierre)}</>}
                        </p>
                        {s.observaciones && <p className="text-xs text-gray-400 italic">{s.observaciones}</p>}
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-right">
                        <div>
                          <p className="text-xs text-[#5F6B7A]">Ventas</p>
                          <p className="text-sm font-bold text-[#072B5A]">{formatCurrency(s.total_ventas ?? 0)}</p>
                          <p className="text-xs text-[#5F6B7A]">{s.cantidad_ventas ?? 0} registros</p>
                        </div>
                        {s.estado === 'cerrada' && (
                          <div>
                            <p className="text-xs text-[#5F6B7A]">Diferencia</p>
                            <p className={`text-sm font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-[#5F6B7A] mb-1">Por método</p>
                          <div className="flex gap-1">
                            {[
                              { k: 'total_efectivo',      icon: Banknote,       v: s.total_efectivo },
                              { k: 'total_tarjeta',       icon: CreditCard,     v: s.total_tarjeta },
                              { k: 'total_transferencia', icon: ArrowLeftRight, v: s.total_transferencia },
                              { k: 'total_mixto',         icon: Layers,         v: s.total_mixto },
                            ].filter(m => (m.v ?? 0) > 0).map(m => {
                              const Icon = m.icon
                              return (
                                <span key={m.k} className="flex items-center gap-0.5 text-xs text-[#5F6B7A] bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                                  <Icon size={10} /> {formatCurrency(m.v ?? 0)}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Paginación simple */}
          {histData?.meta && histData.meta.last_page > 1 && (
            <div className="flex justify-center items-center gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm text-[#5F6B7A] hover:bg-gray-100 disabled:opacity-40 transition-colors">
                Anterior
              </button>
              <span className="text-sm text-[#5F6B7A]">{histPage} / {histData.meta.last_page}</span>
              <button onClick={() => setHistPage(p => Math.min(histData.meta.last_page, p + 1))} disabled={histPage === histData.meta.last_page}
                className="px-3 py-1.5 rounded-lg text-sm text-[#5F6B7A] hover:bg-gray-100 disabled:opacity-40 transition-colors">
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
