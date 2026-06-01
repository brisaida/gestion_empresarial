import { useQuery } from '@tanstack/react-query'
import {
  Package, Truck, AlertTriangle, TrendingUp, ArrowRight,
  TrendingDown, Boxes, ShoppingCart, BarChart2,
} from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { dashboardApi } from '@/api/recursos'
import { MetricCard } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

function VariacionBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-gray-400">Sin datos mes ant.</span>
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct}% vs mes ant.
    </span>
  )
}

export default function DashboardPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', empresaId],
    queryFn:  () => dashboardApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const r = data?.resumen

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Dashboard</h1>
        <p className="text-sm text-[#5F6B7A] mt-0.5">Resumen general del negocio</p>
      </div>

      {/* ── KPIs principales ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Ventas del mes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Ventas del mes</p>
            <div className="w-9 h-9 rounded-lg bg-[#0E78D8]/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-[#0E78D8]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#072B5A] mb-1">
            {isLoading ? '—' : formatCurrency(r?.ventas_mes ?? 0)}
          </p>
          {!isLoading && <VariacionBadge pct={r?.variacion_ventas_pct} />}
        </div>

        {/* Margen bruto */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Margen bruto</p>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <BarChart2 size={18} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#072B5A] mb-1">
            {isLoading ? '—' : formatCurrency(r?.margen_bruto_mes ?? 0)}
          </p>
          {!isLoading && (
            <span className={`text-xs font-semibold ${(r?.margen_pct ?? 0) >= 30 ? 'text-emerald-600' : (r?.margen_pct ?? 0) >= 15 ? 'text-amber-500' : 'text-red-500'}`}>
              {r?.margen_pct ?? 0}% del ingreso
            </span>
          )}
        </div>

        {/* Valor del inventario */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Valor inventario</p>
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Boxes size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#072B5A] mb-1">
            {isLoading ? '—' : formatCurrency(r?.valor_inventario ?? 0)}
          </p>
          <span className="text-xs text-[#5F6B7A]">Capital en stock actual</span>
        </div>

        {/* Compras pendientes */}
        <Link to="/compras/historial" className="block">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-full hover:border-amber-200 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">Compras pendientes</p>
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <ShoppingCart size={18} className="text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#072B5A] mb-1">
              {isLoading ? '—' : `${r?.compras_pendientes_count ?? 0} órdenes`}
            </p>
            <span className="text-xs text-[#5F6B7A]">
              {isLoading ? '—' : `Por recibir: ${formatCurrency(r?.compras_pendientes_monto ?? 0)}`}
            </span>
          </div>
        </Link>
      </div>

      {/* ── KPIs secundarios ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/existencias/stock-bajo" className="block">
          <MetricCard
            title="Stock Bajo"
            value={isLoading ? '—' : (r?.productos_stock_bajo ?? 0)}
            subtitle="Ver alertas →"
            icon={<AlertTriangle size={20} />}
            color={r?.productos_stock_bajo ? 'red' : 'emerald'}
          />
        </Link>
        <MetricCard
          title="Productos activos"
          value={isLoading ? '—' : (r?.total_productos ?? 0)}
          subtitle="En catálogo"
          icon={<Package size={20} />}
          color="electric"
        />
        <MetricCard
          title="Proveedores"
          value={isLoading ? '—' : (r?.total_proveedores ?? 0)}
          subtitle="Activos"
          icon={<Truck size={20} />}
          color="cyan"
        />
      </div>

      {/* ── Paneles de detalle ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas ventas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#0E78D8] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Últimas ventas</h2>
            </div>
            <Link to="/ventas/historial" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-6 py-3 flex justify-between">
                    <div className="h-4 bg-gray-100 rounded-lg w-32 animate-pulse" />
                    <div className="h-4 bg-gray-100 rounded-lg w-20 animate-pulse" />
                  </div>
                ))
              : data?.ultimas_ventas.length === 0
                ? <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin ventas registradas</p>
                : data?.ultimas_ventas.map(v => (
                    <div key={v.id} className="px-6 py-3 flex items-center justify-between hover:bg-[#F4F7FA] transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-[#072B5A]">{v.cliente}</p>
                        <p className="text-xs text-[#5F6B7A]">{formatDate(v.fecha_venta)}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(v.total)}</span>
                    </div>
                  ))
            }
          </div>
        </div>

        {/* Top productos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#38D6D4] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Productos más vendidos</h2>
            </div>
            <Link to="/reportes/productos" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver reporte <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-6 py-3 flex justify-between">
                    <div className="h-4 bg-gray-100 rounded-lg w-40 animate-pulse" />
                    <div className="h-4 bg-gray-100 rounded-lg w-12 animate-pulse" />
                  </div>
                ))
              : data?.top_productos.length === 0
                ? <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin datos de ventas</p>
                : data?.top_productos.map((p, i) => (
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
            }
          </div>
        </div>
      </div>
    </div>
  )
}
