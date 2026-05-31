import { useState } from 'react'
import { Bell, ChevronDown, LogOut, PanelLeftClose, PanelLeft, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/authStore'
import { authApi } from '@/api/auth'

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function Navbar({ collapsed, onToggle }: Props) {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenu, setUserMenu] = useState(false)
  const esSuperAdmin = state.usuario?.es_super_admin ?? false

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-[#5F6B7A] hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>

        {state.empresaActiva && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38D6D4]" />
            <span className="text-sm font-semibold text-[#072B5A]">
              {state.empresaActiva.nombre}
            </span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        <button className="relative p-1.5 rounded-lg text-[#5F6B7A] hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors">
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-[#0E78D8]/8 transition-colors"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)' }}
            >
              {(state.usuario?.nombre?.[0] ?? 'U').toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-medium text-[#072B5A] max-w-32 truncate">
              {state.usuario?.nombre ?? 'Usuario'}
            </span>
            <ChevronDown size={13} className="text-[#5F6B7A]" />
          </button>

          {userMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-100 rounded-xl shadow-xl shadow-black/10 z-20 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-[#072B5A] truncate">{state.usuario?.nombre}</p>
                  <p className="text-xs text-[#5F6B7A] truncate">{state.usuario?.correo}</p>
                </div>
                {esSuperAdmin && (
                  <>
                    <button
                      onClick={() => { setUserMenu(false); navigate('/super-admin') }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors font-medium"
                    >
                      <ShieldCheck size={15} />
                      Panel Super Admin
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
