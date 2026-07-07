import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/stores/authStore'
import { usePermisos } from '@/lib/permisos'
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import AppLayout      from '@/components/layout/AppLayout'
import LoginPage      from '@/pages/auth/LoginPage'
import DashboardPage  from '@/pages/dashboard/DashboardPage'
import ProductosPage    from '@/pages/products/ProductosPage'
import ProductoFormPage from '@/pages/products/ProductoFormPage'
import CategoriasPage from '@/pages/categories/CategoriasPage'
import ProveedoresPage from '@/pages/suppliers/ProveedoresPage'
import ClientesPage   from '@/pages/clients/ClientesPage'
import BodegasPage    from '@/pages/warehouses/BodegasPage'
import ExistenciasPage  from '@/pages/inventory/ExistenciasPage'
import StockBajoPage   from '@/pages/inventory/StockBajoPage'
import MovimientosPage from '@/pages/movements/MovimientosPage'
import ComprasPage         from '@/pages/purchases/ComprasPage'
import HistorialComprasPage from '@/pages/purchases/HistorialComprasPage'
import CotizacionesPage        from '@/pages/quotations/CotizacionesPage'
import HistorialCotizacionesPage from '@/pages/quotations/HistorialCotizacionesPage'
import VentasPage               from '@/pages/sales/VentasPage'
import HistorialVentasPage      from '@/pages/sales/HistorialVentasPage'
import TrasladosPage             from '@/pages/transfers/TrasladosPage'
import HistorialTrasladosPage   from '@/pages/transfers/HistorialTrasladosPage'
import ConfiguracionPage         from '@/pages/settings/ConfiguracionPage'
import RecetasPage               from '@/pages/recipes/RecetasPage'
import ReportesIngresosPage      from '@/pages/reports/ReportesIngresosPage'
import ReportesProductosPage     from '@/pages/reports/ReportesProductosPage'
import ReportesExportarPage      from '@/pages/reports/ReportesExportarPage'
import SuperAdminLayout         from '@/pages/super-admin/SuperAdminLayout'
import DashboardSAPage          from '@/pages/super-admin/DashboardSAPage'
import EmpresasAdminPage        from '@/pages/super-admin/EmpresasAdminPage'
import UsuariosAdminPage        from '@/pages/super-admin/UsuariosAdminPage'
import RolesAdminPage           from '@/pages/super-admin/RolesAdminPage'

function SinPermiso() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Lock size={40} className="text-gray-200 mb-4" />
      <h2 className="text-lg font-bold text-[#072B5A]">Sin permiso</h2>
      <p className="text-sm text-[#5F6B7A] mt-1">Tu rol no tiene acceso a esta sección.<br />Contacta al administrador si crees que es un error.</p>
    </div>
  )
}

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPerm } = usePermisos()
  return hasPerm(perm) ? <>{children}</> : <SinPermiso />
}

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
              <Route path="dashboard"   element={<Guard perm="dashboard"><DashboardPage /></Guard>} />
              <Route path="productos"          element={<Guard perm="catalogos"><ProductosPage /></Guard>} />
              <Route path="productos/nuevo"   element={<Guard perm="catalogos"><ProductoFormPage /></Guard>} />
              <Route path="productos/:id/editar" element={<Guard perm="catalogos"><ProductoFormPage /></Guard>} />
              <Route path="categorias"  element={<Guard perm="catalogos"><CategoriasPage /></Guard>} />
              <Route path="proveedores" element={<Guard perm="catalogos"><ProveedoresPage /></Guard>} />
              <Route path="clientes"    element={<Guard perm="catalogos"><ClientesPage /></Guard>} />
              <Route path="bodegas"     element={<Guard perm="catalogos"><BodegasPage /></Guard>} />
              <Route path="existencias"            element={<Guard perm="inventario"><ExistenciasPage /></Guard>} />
              <Route path="existencias/stock-bajo" element={<Guard perm="inventario"><StockBajoPage /></Guard>} />
              <Route path="movimientos" element={<Guard perm="inventario"><MovimientosPage /></Guard>} />
              <Route path="compras"            element={<Guard perm="compras"><ComprasPage /></Guard>} />
              <Route path="compras/historial" element={<Guard perm="compras"><HistorialComprasPage /></Guard>} />
              <Route path="traslados"           element={<Guard perm="traslados"><TrasladosPage /></Guard>} />
              <Route path="traslados/historial" element={<Guard perm="traslados"><HistorialTrasladosPage /></Guard>} />
              <Route path="cotizaciones"           element={<Guard perm="cotizaciones"><CotizacionesPage /></Guard>} />
              <Route path="cotizaciones/historial" element={<Guard perm="cotizaciones"><HistorialCotizacionesPage /></Guard>} />
              <Route path="ventas"                 element={<Guard perm="ventas"><VentasPage /></Guard>} />
              <Route path="ventas/historial"       element={<Guard perm="ventas"><HistorialVentasPage /></Guard>} />
              <Route path="recetas"                element={<Guard perm="ventas"><RecetasPage /></Guard>} />
              <Route path="reportes/ingresos"      element={<Guard perm="reportes"><ReportesIngresosPage /></Guard>} />
              <Route path="reportes/productos"     element={<Guard perm="reportes"><ReportesProductosPage /></Guard>} />
              <Route path="reportes/exportar"      element={<Guard perm="reportes"><ReportesExportarPage /></Guard>} />
              <Route path="configuracion"          element={<Guard perm="configuracion"><ConfiguracionPage /></Guard>} />
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
