import { NavLink } from 'react-router-dom'
import type React from 'react'
import {
  LayoutDashboard, Package, Tags, Truck, Warehouse,
  Users, BarChart3, ArrowLeftRight, ShoppingCart, Receipt, ClipboardList, FileText, Settings,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/authStore'
import { empresaApi } from '@/api/recursos'

const nav = [
  { group: 'Principal',
    items: [
      { to: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard, end: true },
    ]
  },
  { group: 'Inventario',
    items: [
      { to: '/existencias',      label: 'Stock',            icon: BarChart3,       end: false },
      { to: '/compras',          label: 'Compras',          icon: ShoppingCart,    end: false },
      { to: '/movimientos',      label: 'Movimientos',      icon: ArrowLeftRight,  end: false },
    ]
  },
  { group: 'Cotizaciones',
    items: [
      { to: '/cotizaciones',           label: 'Nueva cotización', icon: FileText,      end: true },
      { to: '/cotizaciones/historial', label: 'Historial',        icon: ClipboardList, end: true },
    ]
  },
  { group: 'Ventas',
    items: [
      { to: '/ventas',           label: 'Nueva venta',      icon: Receipt,         end: true },
      { to: '/ventas/historial', label: 'Historial',        icon: ClipboardList,   end: true },
    ]
  },
  { group: 'Catálogos',
    items: [
      { to: '/productos',        label: 'Productos',        icon: Package,         end: false },
      { to: '/categorias',       label: 'Categorías',       icon: Tags,            end: false },
      { to: '/proveedores',      label: 'Proveedores',      icon: Truck,           end: false },
      { to: '/clientes',         label: 'Clientes',         icon: Users,           end: false },
      { to: '/bodegas',          label: 'Bodegas',          icon: Warehouse,       end: false },
    ]
  },
  { group: 'Sistema',
    items: [
      { to: '/configuracion',    label: 'Configuración',    icon: Settings,        end: true  },
    ]
  },
]

interface NavItem { to: string; label: string; icon: React.ElementType; end: boolean }
interface Props { collapsed: boolean }

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function Sidebar({ collapsed }: Props) {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 5 * 60_000,
  })

  const nombre  = empresaConfig?.nombre ?? state.empresaActiva?.nombre ?? 'Inventario'
  const rawLogo = empresaConfig?.logo_url
  const logoUrl = rawLogo
    ? (rawLogo.startsWith('http') ? rawLogo : `${API_BASE}${rawLogo}`)
    : null

  return (
    <aside
      className={cn(
        'h-screen flex flex-col transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60',
      )}
      style={{ background: 'linear-gradient(180deg, #031B3A 0%, #072B5A 100%)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/8 shrink-0',
        collapsed ? 'justify-center py-4 px-2' : 'gap-3 px-4 py-4',
      )}>
        {/* Logo / inicial */}
        <div className="w-8 h-8 rounded-lg shrink-0 shadow-lg overflow-hidden flex items-center justify-center"
          style={!logoUrl ? { background: 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)' } : undefined}
        >
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            : <span className="text-white text-sm font-bold">
                {nombre[0].toUpperCase()}
              </span>
          }
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight truncate">{nombre}</p>
            <p className="text-[10px] text-[#38D6D4] font-medium tracking-widest uppercase leading-tight">Inventario</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-dark py-3 space-y-4 px-2">
        {nav.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-bold text-[#38D6D4]/70 uppercase tracking-[0.15em]">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {(group.items as NavItem[]).map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#0E78D8] text-white shadow-md shadow-[#0E78D8]/30'
                        : 'text-white/55 hover:bg-white/8 hover:text-white',
                      collapsed && 'justify-center px-0',
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/8 shrink-0">
        {!collapsed && (
          <p className="text-[10px] text-white/25 text-center font-medium">v1.0.0</p>
        )}
      </div>
    </aside>
  )
}
