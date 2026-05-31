import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Users, ArrowLeft, ShieldCheck, ShieldEllipsis, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/super-admin/empresas',  label: 'Empresas',  icon: Building2       },
  { to: '/super-admin/usuarios',  label: 'Usuarios',  icon: Users           },
  { to: '/super-admin/roles',     label: 'Roles',     icon: ShieldEllipsis  },
]

export default function SuperAdminLayout() {
  const { state } = useAuth()
  const navigate = useNavigate()

  if (!state.token) return <Navigate to="/login" replace />
  if (!state.usuario?.es_super_admin) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex h-screen bg-[#F4F7FA] overflow-hidden">
      {/* Sidebar SA */}
      <aside className="w-60 h-screen flex flex-col shrink-0" style={{ background: 'linear-gradient(180deg, #031B3A 0%, #072B5A 100%)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)' }}
          >
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Super Admin</p>
            <p className="text-[10px] text-[#38D6D4] font-medium tracking-widest uppercase leading-tight">Panel global</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-dark py-3 px-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#0E78D8] text-white shadow-md shadow-[#0E78D8]/30'
                  : 'text-white/55 hover:bg-white/8 hover:text-white',
              )}
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Volver */}
        {state.empresaActiva && (
          <div className="p-3 border-t border-white/8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/55 hover:text-white hover:bg-white/8 transition-colors"
            >
              <ArrowLeft size={16} />
              Volver a la app
            </button>
          </div>
        )}
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
