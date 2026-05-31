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
import ExistenciasPage  from '@/pages/inventory/ExistenciasPage'
import StockBajoPage   from '@/pages/inventory/StockBajoPage'
import MovimientosPage from '@/pages/movements/MovimientosPage'
import ComprasPage    from '@/pages/purchases/ComprasPage'
import CotizacionesPage        from '@/pages/quotations/CotizacionesPage'
import HistorialCotizacionesPage from '@/pages/quotations/HistorialCotizacionesPage'
import VentasPage               from '@/pages/sales/VentasPage'
import HistorialVentasPage      from '@/pages/sales/HistorialVentasPage'
import TrasladosPage             from '@/pages/transfers/TrasladosPage'
import HistorialTrasladosPage   from '@/pages/transfers/HistorialTrasladosPage'
import ConfiguracionPage        from '@/pages/settings/ConfiguracionPage'
import SuperAdminLayout         from '@/pages/super-admin/SuperAdminLayout'
import DashboardSAPage          from '@/pages/super-admin/DashboardSAPage'
import EmpresasAdminPage        from '@/pages/super-admin/EmpresasAdminPage'
import UsuariosAdminPage        from '@/pages/super-admin/UsuariosAdminPage'
import RolesAdminPage           from '@/pages/super-admin/RolesAdminPage'

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
              <Route path="existencias"         element={<ExistenciasPage />} />
              <Route path="existencias/stock-bajo" element={<StockBajoPage />} />
              <Route path="movimientos" element={<MovimientosPage />} />
              <Route path="compras"     element={<ComprasPage />} />
              <Route path="traslados"           element={<TrasladosPage />} />
              <Route path="traslados/historial" element={<HistorialTrasladosPage />} />
              <Route path="cotizaciones"           element={<CotizacionesPage />} />
              <Route path="cotizaciones/historial" element={<HistorialCotizacionesPage />} />
              <Route path="ventas"                 element={<VentasPage />} />
              <Route path="ventas/historial"       element={<HistorialVentasPage />} />
              <Route path="configuracion"          element={<ConfiguracionPage />} />
            </Route>

            <Route element={<SuperAdminLayout />}>
              <Route path="super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
              <Route path="super-admin/dashboard" element={<DashboardSAPage />} />
              <Route path="super-admin/empresas"  element={<EmpresasAdminPage />} />
              <Route path="super-admin/usuarios"  element={<UsuariosAdminPage />} />
              <Route path="super-admin/roles"     element={<RolesAdminPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
