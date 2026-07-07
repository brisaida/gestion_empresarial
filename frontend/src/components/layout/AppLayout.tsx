import { useState, useEffect, useCallback } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useAuth } from '@/stores/authStore'
import { useIdleLogout } from '@/hooks/useIdleLogout'

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

export default function AppLayout() {
  const { state, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleIdleLogout = useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  useIdleLogout(handleIdleLogout, 15)

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
    </div>
  )
}
