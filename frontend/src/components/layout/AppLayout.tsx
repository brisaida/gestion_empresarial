import { useState, useEffect, useCallback } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useAuth } from '@/stores/authStore'
import { useIdleLogout } from '@/hooks/useIdleLogout'
import { Clock } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isMobile
}

/** Cuenta regresiva de 60 → 0 segundos para el modal de inactividad */
function useCountdown(active: boolean) {
  const [seconds, setSeconds] = useState(60)
  useEffect(() => {
    if (!active) { setSeconds(60); return }
    setSeconds(60)
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active])
  return seconds
}

export default function AppLayout() {
  const { state, logout } = useAuth()
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [showWarn, setShowWarn]       = useState(false)
  const isMobile  = useIsMobile()
  const location  = useLocation()
  const navigate  = useNavigate()
  const countdown = useCountdown(showWarn)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleLogout = useCallback(() => {
    setShowWarn(false)
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const handleWarn = useCallback(() => {
    setShowWarn(true)
  }, [])

  // Cualquier actividad del usuario descarta el aviso
  const handleContinue = () => setShowWarn(false)

  useIdleLogout({ onLogout: handleLogout, onWarn: handleWarn, minutes: 30, warnMinutesBefore: 1 })

  if (!state.token) return <Navigate to="/login" replace />

  const handleToggle = () => {
    if (isMobile) setMobileOpen(v => !v)
    else setCollapsed(v => !v)
  }

  return (
    <div className="flex h-screen bg-[#F4F7FA] overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#031B3A]/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar collapsed={collapsed} onToggle={handleToggle} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Modal de aviso de inactividad */}
      {showWarn && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-[#072B5A] mb-2">¿Seguís ahí?</h2>
            <p className="text-sm text-[#5F6B7A] mb-1">
              Tu sesión se cerrará automáticamente por inactividad.
            </p>
            <p className="text-3xl font-bold text-amber-600 my-4">{countdown}s</p>
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-[#5F6B7A] hover:bg-gray-50 transition-colors"
              >
                Cerrar sesión
              </button>
              <button
                onClick={handleContinue}
                className="flex-1 py-2.5 rounded-xl bg-[var(--cp)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
