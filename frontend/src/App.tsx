import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/stores/authStore'
import AppLayout      from '@/components/layout/AppLayout'
import LoginPage      from '@/pages/auth/LoginPage'
import DashboardPage  from '@/pages/dashboard/DashboardPage'
import ProductosPage  from '@/pages/products/ProductosPage'
import CategoriasPage from '@/pages/categories/CategoriasPage'
import ProveedoresPage from '@/pages/suppliers/ProveedoresPage'
import ClientesPage   from '@/pages/clients/ClientesPage'
import BodegasPage    from '@/pages/warehouses/BodegasPage'
import ExistenciasPage from '@/pages/inventory/ExistenciasPage'
import MovimientosPage from '@/pages/movements/MovimientosPage'
import ComprasPage    from '@/pages/purchases/ComprasPage'
import VentasPage          from '@/pages/sales/VentasPage'
import HistorialVentasPage from '@/pages/sales/HistorialVentasPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"   element={<DashboardPage />} />
              <Route path="productos"   element={<ProductosPage />} />
              <Route path="categorias"  element={<CategoriasPage />} />
              <Route path="proveedores" element={<ProveedoresPage />} />
              <Route path="clientes"    element={<ClientesPage />} />
              <Route path="bodegas"     element={<BodegasPage />} />
              <Route path="existencias" element={<ExistenciasPage />} />
              <Route path="movimientos" element={<MovimientosPage />} />
              <Route path="compras"     element={<ComprasPage />} />
              <Route path="ventas"          element={<VentasPage />} />
              <Route path="ventas/historial" element={<HistorialVentasPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
