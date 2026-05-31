import { useQuery } from '@tanstack/react-query'
import { Building2, Users, ShieldCheck, BookOpen, TrendingUp, UserCheck, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { saDashboardApi } from '@/api/superAdmin'
import { MetricCard } from '@/components/ui/Card'

export default function DashboardSAPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn: () => saDashboardApi.get().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const stats = data?.stats

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Dashboard</h1>
        <p className="text-sm text-[#5F6B7A] mt-0.5">Visión global de la plataforma</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          title="Empresas registradas"
          value={isLoading ? '—' : (stats?.total_empresas ?? 0)}
          subtitle={`${stats?.empresas_activas ?? 0} activas`}
          icon={<Building2 size={20} />}
          color="electric"
        />
        <MetricCard
          title="Usuarios registrados"
          value={isLoading ? '—' : (stats?.total_usuarios ?? 0)}
          subtitle={`${stats?.usuarios_activos ?? 0} activos`}
          icon={<Users size={20} />}
          color="cyan"
        />
        <MetricCard
          title="Super admins"
          value={isLoading ? '—' : (stats?.super_admins ?? 0)}
          icon={<ShieldCheck size={20} />}
          color="indigo"
        />
        <MetricCard
          title="Empresas activas"
          value={isLoading ? '—' : (stats?.empresas_activas ?? 0)}
          subtitle={`${(stats?.total_empresas ?? 0) - (stats?.empresas_activas ?? 0)} inactivas`}
          icon={<TrendingUp size={20} />}
          color="emerald"
        />
        <MetricCard
          title="Usuarios activos"
          value={isLoading ? '—' : (stats?.usuarios_activos ?? 0)}
          icon={<UserCheck size={20} />}
          color="emerald"
        />
        <MetricCard
          title="Roles definidos"
          value={isLoading ? '—' : (stats?.total_roles ?? 0)}
          icon={<BookOpen size={20} />}
          color="amber"
        />
      </div>

      {/* Recientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Últimas empresas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#0E78D8] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Empresas recientes</h2>
            </div>
            <Link to="/super-admin/empresas" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
                      <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              : data?.empresas_recientes.length === 0
              ? <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin empresas registradas</p>
              : data?.empresas_recientes.map(e => (
                  <div key={e.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[#F4F7FA] transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #0E78D8, #38D6D4)' }}
                    >
                      {e.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#072B5A] truncate">{e.nombre}</p>
                      <p className="text-xs text-[#5F6B7A]">{e.usuarios_count} usuario{e.usuarios_count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {e.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Últimos usuarios */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#38D6D4] inline-block" />
              <h2 className="text-sm font-semibold text-[#072B5A]">Usuarios recientes</h2>
            </div>
            <Link to="/super-admin/usuarios" className="text-xs text-[#0E78D8] hover:text-[#072B5A] flex items-center gap-1 font-semibold transition-colors">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                      <div className="h-2.5 w-44 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              : data?.usuarios_recientes.length === 0
              ? <p className="px-6 py-8 text-sm text-[#5F6B7A] text-center">Sin usuarios registrados</p>
              : data?.usuarios_recientes.map(u => (
                  <div key={u.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[#F4F7FA] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#0E78D8]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#0E78D8]">{u.nombre[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#072B5A] truncate">{u.nombre}</p>
                      <p className="text-xs text-[#5F6B7A] truncate">{u.correo}</p>
                    </div>
                    {u.es_super_admin && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0E78D8]/10 text-[#0E78D8]">SA</span>
                    )}
                  </div>
                ))
            }
          </div>
        </div>

      </div>
    </div>
  )
}
