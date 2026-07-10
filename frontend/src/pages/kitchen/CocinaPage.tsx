import { useState, useEffect, useCallback } from 'react'
import { ChefHat, Clock, CheckCircle2, RefreshCw, Receipt, AlertTriangle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comandasApi, ventasApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'
import type { Comanda } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

type TabEstado = 'activos' | 'listos'

function minutosDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function colorPorTiempo(min: number): string {
  if (min < 5)  return 'border-emerald-400 bg-emerald-50'
  if (min < 12) return 'border-amber-400 bg-amber-50'
  return 'border-red-400 bg-red-50'
}

function badgePorTiempo(min: number) {
  if (min < 5)  return <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{min}m</span>
  if (min < 12) return <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{min}m</span>
  return <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={11}/>{min}m</span>
}

function estadoBadge(estado: Comanda['estado']) {
  const map = {
    pendiente:       'bg-gray-100 text-gray-600',
    en_preparacion:  'bg-amber-100 text-amber-700',
    listo:           'bg-emerald-100 text-emerald-700',
    cancelado:       'bg-red-100 text-red-600',
  }
  const labels = { pendiente: 'Pendiente', en_preparacion: 'En preparación', listo: 'Listo', cancelado: 'Cancelado' }
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[estado]}`}>{labels[estado]}</span>
}

interface FacturarModalProps {
  comanda: Comanda
  onClose: () => void
  onDone: () => void
}

function FacturarModal({ comanda, onClose, onDone }: FacturarModalProps) {
  const [error, setError] = useState('')
  const total = comanda.detalles.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0)

  const facturar = useMutation({
    mutationFn: () => comandasApi.facturar(comanda.id, {}),
    onSuccess: onDone,
    onError: (e) => setError(getAxiosError(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Facturar ${comanda.numero_comanda}`} size="sm">
      <div className="space-y-4">
        <div className="bg-[#F4F7FA] rounded-lg p-3 space-y-1.5">
          {comanda.detalles.map(d => (
            <div key={d.id} className="flex justify-between text-sm">
              <span className="text-[#5F6B7A]">{d.nombre_item} × {d.cantidad}</span>
              <span className="font-medium text-[#072B5A]">{formatCurrency(d.cantidad * d.precio_unitario)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-[#072B5A]">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button icon={<Receipt size={15}/>} loading={facturar.isPending} onClick={() => facturar.mutate()} className="flex-1">
            Generar factura
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function CocinaPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [tab, setTab]             = useState<TabEstado>('activos')
  const [comandas, setComandas]   = useState<Comanda[]>([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [facturarComanda, setFacturarComanda] = useState<Comanda | null>(null)
  const [, setTick] = useState(0)

  const fetchComandas = useCallback(async () => {
    if (!empresaId) return
    const estado = tab === 'activos' ? 'pendiente,en_preparacion' : 'listo'
    try {
      const res = await comandasApi.list({ empresa_id: empresaId, estado })
      setComandas((res.data as { data: Comanda[] }).data)
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }, [empresaId, tab])

  // Carga inicial y polling cada 30s
  useEffect(() => {
    setLoading(true)
    fetchComandas()
    const id = setInterval(fetchComandas, 30_000)
    return () => clearInterval(id)
  }, [fetchComandas])

  // Tick cada minuto para actualizar los badges de tiempo sin re-fetch
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const marcarItem = useMutation({
    mutationFn: ({ comandaId, detalleId, listo }: { comandaId: number; detalleId: number; listo: boolean }) =>
      comandasApi.marcarItemListo(comandaId, detalleId, listo),
    onSuccess: (res) => {
      const updated = (res.data as { data: Comanda }).data
      setComandas(prev => prev.map(c => c.id === updated.id ? updated : c))
    },
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => comandasApi.actualizarEstado(id, estado),
    onSuccess: () => fetchComandas(),
  })

  const tabs: { key: TabEstado; label: string }[] = [
    { key: 'activos', label: 'Activos' },
    { key: 'listos',  label: 'Listos para entregar' },
  ]

  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 100%)' }}>
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#072B5A]">Pantalla de Cocina</h1>
            <p className="text-xs text-[#5F6B7A]">
              Actualizado: {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#5F6B7A]">{comandas.length} pedido{comandas.length !== 1 ? 's' : ''}</span>
          <button
            onClick={fetchComandas}
            className="p-2 rounded-lg border border-gray-200 text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F4F7FA] p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-[#072B5A] shadow-sm' : 'text-[#5F6B7A] hover:text-[#072B5A]'
            }`}>
            {t.label}
            {t.key === 'activos' && comandas.length > 0 && tab === 'activos' && (
              <span className="ml-1.5 text-xs font-bold text-white bg-[#0E78D8] px-1.5 py-0.5 rounded-full">{comandas.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Grid de comandas */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border-2 border-gray-100 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : comandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F4F7FA] border border-gray-100 flex items-center justify-center mb-3">
            <ChefHat size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-[#5F6B7A]">
            {tab === 'activos' ? 'Sin pedidos activos' : 'Sin pedidos listos'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Los pedidos aparecerán aquí cuando se envíen desde el POS</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {comandas.map(comanda => {
            const min = minutosDesde(comanda.created_at)
            const todosListos = comanda.detalles.every(d => d.listo)

            return (
              <div key={comanda.id}
                className={`bg-white rounded-xl border-2 flex flex-col transition-all ${colorPorTiempo(min)}`}>

                {/* Card header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#072B5A] text-base leading-tight">{comanda.numero_comanda}</p>
                      {comanda.mesa && (
                        <p className="text-sm text-[#5F6B7A] font-medium mt-0.5">{comanda.mesa}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {badgePorTiempo(min)}
                      {estadoBadge(comanda.estado)}
                    </div>
                  </div>
                  {comanda.observaciones && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {comanda.observaciones}
                    </p>
                  )}
                </div>

                {/* Ítems */}
                <div className="flex-1 px-4 py-3 space-y-2">
                  {comanda.detalles.map(det => (
                    <label key={det.id}
                      className={`flex items-start gap-2.5 cursor-pointer group ${det.listo ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={det.listo}
                        onChange={e => marcarItem.mutate({ comandaId: comanda.id, detalleId: det.id, listo: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-[#0E78D8] rounded cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-tight ${det.listo ? 'line-through text-gray-400' : 'text-[#072B5A]'}`}>
                          {det.nombre_item}
                          {det.cantidad !== 1 && <span className="text-[#0E78D8] ml-1">×{det.cantidad}</span>}
                        </p>
                        {det.notas && (
                          <p className="text-xs text-amber-600 mt-0.5">{det.notas}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Acciones */}
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
                  {tab === 'activos' && (
                    <button
                      onClick={() => cambiarEstado.mutate({ id: comanda.id, estado: 'listo' })}
                      disabled={!todosListos || cambiarEstado.isPending}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        todosListos
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-[0.98]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                      {todosListos ? 'Marcar como listo' : `Faltan ${comanda.detalles.filter(d => !d.listo).length} ítems`}
                    </button>
                  )}
                  {tab === 'listos' && (
                    <Button
                      icon={<Receipt size={14} />}
                      onClick={() => setFacturarComanda(comanda)}
                      className="w-full justify-center"
                    >
                      Facturar
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal facturar */}
      {facturarComanda && (
        <FacturarModal
          comanda={facturarComanda}
          onClose={() => setFacturarComanda(null)}
          onDone={() => { setFacturarComanda(null); fetchComandas(); qc.invalidateQueries({ queryKey: ['ventas'] }) }}
        />
      )}
    </div>
  )
}
