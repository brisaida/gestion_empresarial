import { useQuery } from '@tanstack/react-query'
import { Package, Truck, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { dashboardApi } from '@/api/recursos'
import { MetricCard } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', empresaId],
    queryFn:  () => dashboardApi.get(empresaId).then((r) => r.data.data),
    enabled:  empresaId > 0,
  })

  const resumen = data?.resumen

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Dashboard</h1>
        <p className="text-sm text-[#5F6B7A] mt-0.5">Resumen general del inventario</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total Productos"
          value={isLoading ? '—' : (resumen?.total_productos ?? 0)}
          subtitle="Productos activos"
          icon={<Package size={20} />}
          color="electric"
        />
        <MetricCard
          title="Proveedores"
          value={isLoading ? '—' : (resumen?.total_proveedores ?? 0)}
          subtitle="Proveedores activos"
          icon={<Truck size={20} />}
          color="cyan"
        />
        <MetricCard
          title="Stock Bajo"
          value={isLoading ? '—' : (resumen?.productos_stock_bajo ?? 0)}
          subtitle="Productos por reabastecer"
          icon={<AlertTriangle size={20} />}
          color={resumen?.productos_stock_bajo ? 'red' : 'emerald'}
        />
        <MetricCard
          title="Ventas del Mes"
          value={isLoading ? '—' : formatCurrency(resumen?.ventas_mes ?? 0)}
          subtitle="Mes actual"
          icon={<TrendingUp size={20} />}
          color="emerald"
          trend={resumen ? { value: `Compras: ${formatCurrency(resumen.compras_mes)}`, up: resumen.ventas_mes >= resumen.compras_mes } : undefined}
        />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas ventas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#0E78D8] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Últimas Ventas</h2>
            </div>
            <Link to="/ventas" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-3 flex justify-between">
                  <div className="h-4 bg-gray-100 rounded-lg w-32 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-lg w-20 animate-pulse" />
                </div>
              ))
            ) : data?.ultimas_ventas.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin ventas registradas</p>
            ) : (
              data?.ultimas_ventas.map((v) => (
                <div key={v.id} className="px-6 py-3 flex items-center justify-between hover:bg-[#F4F7FA] transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-[#072B5A]">{v.cliente}</p>
                    <p className="text-xs text-[#5F6B7A]">{formatDate(v.fecha_venta)}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(v.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top productos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#38D6D4] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Productos Más Vendidos</h2>
            </div>
            <Link to="/productos" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-3 flex justify-between">
                  <div className="h-4 bg-gray-100 rounded-lg w-40 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-lg w-12 animate-pulse" />
                </div>
              ))
            ) : data?.top_productos.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin datos de ventas</p>
            ) : (
              data?.top_productos.map((p, i) => (
                <div key={p.producto_id} className="px-6 py-3 flex items-center justify-between hover:bg-[#F4F7FA] transition-colors">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: i === 0 ? 'linear-gradient(135deg, #0E78D8, #38D6D4)' : '#F4F7FA', color: i === 0 ? 'white' : '#5F6B7A' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm text-[#072B5A] font-medium">{p.nombre}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#5F6B7A]">{p.total_vendido} uds</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
