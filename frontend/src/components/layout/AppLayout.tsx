import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useAuth } from '@/stores/authStore'

export default function AppLayout() {
  const { state } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (!state.token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen bg-[#F4F7FA] overflow-hidden">
      <Sidebar collapsed={collapsed} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
