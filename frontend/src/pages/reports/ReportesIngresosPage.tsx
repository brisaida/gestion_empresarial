import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { reportesApi } from '@/api/recursos'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, ShoppingBag, BarChart2 } from 'lucide-react'

// ── Presets de período ────────────────────────────────────────────────────

type Preset = '7d' | '30d' | '3m' | '12m'

const localISO = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const hoy = () => localISO()
const subDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localISO(d)
}

const PRESETS: { key: Preset; label: string; desde: () => string; agrupacion: string }[] = [
  { key: '7d',  label: '7 días',   desde: () => subDays(6),   agrupacion: 'dia'    },
  { key: '30d', label: '30 días',  desde: () => subDays(29),  agrupacion: 'dia'    },
  { key: '3m',  label: '3 meses',  desde: () => subDays(89),  agrupacion: 'semana' },
  { key: '12m', label: '12 meses', desde: () => subDays(364), agrupacion: 'mes'    },
]

// ── Formateo de etiquetas del eje X ──────────────────────────────────────

function fmtEje(periodo: string, agrupacion: string): string {
  const [y, m, d] = periodo.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (agrupacion === 'mes') {
    return date.toLocaleDateString('es', { month: 'short', year: '2-digit' })
  }
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

// ── Tooltip personalizado ─────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, agrupacion }: {
  active?: boolean; payload?: { value: number }[]; label?: string; agrupacion: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-[#072B5A] mb-1">{label ? fmtEje(label, agrupacion) : ''}</p>
      <p className="text-[#0E78D8] font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

export default function ReportesIngresosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const [preset, setPreset] = useState<Preset>('30d')

  const presetActivo = PRESETS.find(p => p.key === preset)!
  const desde      = presetActivo.desde()
  const hasta      = hoy()
  const agrupacion = presetActivo.agrupacion

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ingresos', empresaId, preset],
    queryFn: () => reportesApi.ingresos({
      empresa_id:  empresaId,
      fecha_desde: desde,
      fecha_hasta: hasta,
      agrupacion,
    }).then(r => (r.data as { data: { filas: { periodo: string; total: number; cantidad: number }[]; resumen: { total: number; cantidad: number; promedio: number } } }).data),
    enabled: empresaId > 0,
    staleTime: 60_000,
  })

  const filas   = data?.filas   ?? []
  const resumen = data?.resumen ?? { total: 0, cantidad: 0, promedio: 0 }

  const chartData = filas.map(f => ({
    periodo:  f.periodo,
    total:    f.total,
    cantidad: f.cantidad,
    label:    fmtEje(f.periodo, agrupacion),
  }))

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Ingresos por período</h1>
          <p className="text-sm text-[#5F6B7A]">Ventas completadas en el rango seleccionado</p>
        </div>

        {/* Selector de preset */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                preset === p.key
                  ? 'bg-[#0E78D8] text-white shadow-sm'
                  : 'text-[#5F6B7A] hover:bg-gray-100'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#0E78D8]/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-[#0E78D8]" />
            </div>
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Total ingresos</p>
          </div>
          <p className="text-2xl font-bold text-[#072B5A]">
            {isLoading ? '—' : formatCurrency(resumen.total)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ShoppingBag size={18} className="text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">N° de ventas</p>
          </div>
          <p className="text-2xl font-bold text-[#072B5A]">
            {isLoading ? '—' : resumen.cantidad.toLocaleString('es')}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart2 size={18} className="text-purple-600" />
            </div>
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Promedio por venta</p>
          </div>
          <p className="text-2xl font-bold text-[#072B5A]">
            {isLoading ? '—' : formatCurrency(resumen.promedio)}
          </p>
        </div>
      </div>

      {/* Gráfica */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-[#072B5A] mb-5">Ingresos por {agrupacion === 'dia' ? 'día' : agrupacion === 'semana' ? 'semana' : 'mes'}</p>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-[#5F6B7A]">Cargando...</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-[#5F6B7A]">Sin ventas en este período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
              <XAxis
                dataKey="periodo"
                tickFormatter={v => fmtEje(v, agrupacion)}
                tick={{ fontSize: 11, fill: '#5F6B7A' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `L ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#5F6B7A' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip agrupacion={agrupacion} />} cursor={{ fill: '#F4F7FA' }} />
              <Bar dataKey="total" fill="#0E78D8" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabla de detalle */}
      {!isLoading && filas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Período</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">N° ventas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...filas].reverse().map(f => (
                <tr key={f.periodo} className="hover:bg-[#F4F7FA]">
                  <td className="px-4 py-3 font-medium text-[#072B5A]">{fmtEje(f.periodo, agrupacion)}</td>
                  <td className="px-4 py-3 text-right text-[#5F6B7A]">{f.cantidad}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#072B5A]">{formatCurrency(f.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 font-bold text-[#072B5A]">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#072B5A]">{resumen.cantidad}</td>
                <td className="px-4 py-3 text-right font-bold text-[#072B5A]">{formatCurrency(resumen.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
