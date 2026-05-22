import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tags, Truck, Warehouse,
  Users, BarChart3, ArrowLeftRight, ShoppingCart, Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { group: 'Principal',
    items: [
      { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    ]
  },
  { group: 'Inventario',
    items: [
      { to: '/productos',   label: 'Productos',   icon: Package },
      { to: '/existencias', label: 'Stock',        icon: BarChart3 },
      { to: '/movimientos', label: 'Movimientos',  icon: ArrowLeftRight },
    ]
  },
  { group: 'Transacciones',
    items: [
      { to: '/compras',     label: 'Compras',      icon: ShoppingCart },
      { to: '/ventas',      label: 'Ventas',        icon: Receipt },
    ]
  },
  { group: 'Catálogos',
    items: [
      { to: '/categorias',  label: 'Categorías',   icon: Tags },
      { to: '/proveedores', label: 'Proveedores',  icon: Truck },
      { to: '/clientes',    label: 'Clientes',     icon: Users },
      { to: '/bodegas',     label: 'Bodegas',      icon: Warehouse },
    ]
  },
]

interface Props { collapsed: boolean }

export default function Sidebar({ collapsed }: Props) {
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
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)' }}
        >
          <Package size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white text-sm leading-tight">Inventario</p>
            <p className="text-[10px] text-[#38D6D4] font-medium tracking-widest uppercase leading-tight">Vilena Dev</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {nav.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-bold text-[#38D6D4]/70 uppercase tracking-[0.15em]">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
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
