import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { reportesApi } from '@/api/recursos'
import { formatCurrency } from '@/lib/utils'

type Preset = '7d' | '30d' | '3m' | '12m'

const hoy = () => new Date().toISOString().slice(0, 10)
const subDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS: { key: Preset; label: string; desde: () => string }[] = [
  { key: '7d',  label: '7 días',   desde: () => subDays(6)   },
  { key: '30d', label: '30 días',  desde: () => subDays(29)  },
  { key: '3m',  label: '3 meses',  desde: () => subDays(89)  },
  { key: '12m', label: '12 meses', desde: () => subDays(364) },
]

interface ProductoFila {
  producto_id: number
  nombre: string
  codigo?: string
  total_unidades: number
  total_monto: number
}

export default function ReportesProductosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const [preset, setPreset] = useState<Preset>('30d')

  const presetActivo = PRESETS.find(p => p.key === preset)!

  const { data: rows = [], isLoading } = useQuery<ProductoFila[]>({
    queryKey: ['reporte-top-productos', empresaId, preset],
    queryFn: () => reportesApi.topProductos({
      empresa_id:  empresaId,
      fecha_desde: presetActivo.desde(),
      fecha_hasta: hoy(),
      limit:       10,
    }).then(r => (r.data as { data: ProductoFila[] }).data),
    enabled: empresaId > 0,
    staleTime: 60_000,
  })

  const maxMonto = rows.length > 0 ? Math.max(...rows.map(r => r.total_monto)) : 1

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Top productos</h1>
          <p className="text-sm text-[#5F6B7A]">Los 10 productos con mayor ingreso en el período</p>
        </div>

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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-[#5F6B7A]">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-[#5F6B7A]">Sin ventas en este período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Producto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide w-28">Unidades</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide w-32">Ingreso</th>
                <th className="px-4 py-3 w-48"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => {
                const pct = Math.round((r.total_monto / maxMonto) * 100)
                return (
                  <tr key={r.producto_id} className="hover:bg-[#F4F7FA]">
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-[#0E78D8] text-white' :
                        i === 1 ? 'bg-[#072B5A] text-white' :
                        i === 2 ? 'bg-[#38D6D4] text-white' :
                        'bg-gray-100 text-[#5F6B7A]'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[#072B5A]">{r.nombre}</p>
                      {r.codigo && <p className="text-xs text-[#5F6B7A] font-mono">{r.codigo}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#5F6B7A]">
                      {Number(r.total_unidades).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#072B5A]">
                      {formatCurrency(r.total_monto)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: i === 0
                                ? 'linear-gradient(90deg, #0E78D8, #38D6D4)'
                                : '#0E78D8',
                              opacity: 1 - i * 0.07,
                            }}
                          />
                        </div>
                        <span className="text-xs text-[#5F6B7A] w-9 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
