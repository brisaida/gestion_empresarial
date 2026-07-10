import client from './client'
import type {
  PaginatedResponse, ApiResponse,
  Categoria, Marca, UnidadMedida, Proveedor, Cliente, Bodega,
  Producto, Existencia, DashboardData, Movimiento, Compra, Venta, Cotizacion,
  Transferencia, EmpresaConfig, Receta, Comanda, Mesa, SesionCaja,
} from '@/types'

const list = <T>(url: string, params?: Record<string, unknown>) =>
  client.get<PaginatedResponse<T>>(url, { params })

const get = <T>(url: string) =>
  client.get<ApiResponse<T>>(url)

const create = <T>(url: string, data: unknown) =>
  client.post<ApiResponse<T>>(url, data)

const update = <T>(url: string, data: unknown) =>
  client.put<ApiResponse<T>>(url, data)

const remove = (url: string) =>
  client.delete<ApiResponse<null>>(url)

// ── Empresa (configuración) ────────────────────────────────────────────────
export const empresaApi = {
  get: (empresaId: number) =>
    client.get<ApiResponse<EmpresaConfig>>('/empresa', { params: { empresa_id: empresaId } }),
  update: (empresaId: number, data: Partial<EmpresaConfig>) =>
    client.put<ApiResponse<EmpresaConfig>>('/empresa', { ...data, empresa_id: empresaId }),
  uploadLogo: (empresaId: number, file: File) => {
    const form = new FormData()
    form.append('logo', file)
    form.append('empresa_id', String(empresaId))
    return client.post<ApiResponse<{ logo_url: string }>>('/empresa/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteLogo: (empresaId: number) =>
    client.delete<ApiResponse<null>>('/empresa/logo', { params: { empresa_id: empresaId } }),
  logoBase64: (empresaId: number) =>
    client.get<ApiResponse<{ logo_base64: string | null }>>('/empresa/logo-base64', { params: { empresa_id: empresaId } }),
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: (empresaId: number) =>
    client.get<ApiResponse<DashboardData>>('/dashboard', { params: { empresa_id: empresaId } }),
}

// ── Categorías ─────────────────────────────────────────────────────────────
export const categoriasApi = {
  list:    (params: Record<string, unknown>) => list<Categoria>('/categorias', params),
  get:     (id: number) => get<Categoria>(`/categorias/${id}`),
  create:  (data: unknown) => create<Categoria>('/categorias', data),
  update:  (id: number, data: unknown) => update<Categoria>(`/categorias/${id}`, data),
  delete:  (id: number) => remove(`/categorias/${id}`),
}

// ── Marcas ─────────────────────────────────────────────────────────────────
export const marcasApi = {
  list:    (params: Record<string, unknown>) => list<Marca>('/marcas', params),
  create:  (data: unknown) => create<Marca>('/marcas', data),
  update:  (id: number, data: unknown) => update<Marca>(`/marcas/${id}`, data),
  delete:  (id: number) => remove(`/marcas/${id}`),
}

// ── Unidades de Medida ────────────────────────────────────────────────────
export const unidadesApi = {
  list:    (params: Record<string, unknown>) => list<UnidadMedida>('/unidades-medida', params),
  create:  (data: unknown) => create<UnidadMedida>('/unidades-medida', data),
  update:  (id: number, data: unknown) => update<UnidadMedida>(`/unidades-medida/${id}`, data),
  delete:  (id: number) => remove(`/unidades-medida/${id}`),
}

// ── Proveedores ────────────────────────────────────────────────────────────
export const proveedoresApi = {
  list:    (params: Record<string, unknown>) => list<Proveedor>('/proveedores', params),
  get:     (id: number) => get<Proveedor>(`/proveedores/${id}`),
  create:  (data: unknown) => create<Proveedor>('/proveedores', data),
  update:  (id: number, data: unknown) => update<Proveedor>(`/proveedores/${id}`, data),
  delete:  (id: number) => remove(`/proveedores/${id}`),
}

// ── Clientes ───────────────────────────────────────────────────────────────
export const clientesApi = {
  list:    (params: Record<string, unknown>) => list<Cliente>('/clientes', params),
  get:     (id: number) => get<Cliente>(`/clientes/${id}`),
  create:  (data: unknown) => create<Cliente>('/clientes', data),
  update:  (id: number, data: unknown) => update<Cliente>(`/clientes/${id}`, data),
  delete:  (id: number) => remove(`/clientes/${id}`),
}

// ── Bodegas ────────────────────────────────────────────────────────────────
export const bodegasApi = {
  list:              (params: Record<string, unknown>) => list<Bodega>('/bodegas', params),
  get:               (id: number) => get<Bodega>(`/bodegas/${id}`),
  create:            (data: unknown) => create<Bodega>('/bodegas', data),
  update:            (id: number, data: unknown) => update<Bodega>(`/bodegas/${id}`, data),
  delete:            (id: number) => remove(`/bodegas/${id}`),
  setPredeterminada: (id: number) => client.patch<ApiResponse<Bodega>>(`/bodegas/${id}/predeterminada`),
}

// ── Productos ──────────────────────────────────────────────────────────────
export const productosApi = {
  list:    (params: Record<string, unknown>) => list<Producto>('/productos', params),
  get:     (id: number) => get<Producto>(`/productos/${id}`),
  create:  (data: unknown) => create<Producto>('/productos', data),
  update:  (id: number, data: unknown) => update<Producto>(`/productos/${id}`, data),
  delete:  (id: number) => remove(`/productos/${id}`),
  uploadImagen: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('imagen', file)
    return client.post<ApiResponse<Producto>>(`/productos/${id}/imagen`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  importar: (empresaId: number, file: File) => {
    const form = new FormData()
    form.append('empresa_id', String(empresaId))
    form.append('archivo', file)
    return client.post<ApiResponse<{ creados: number; errores: { fila: number; error: string }[] }>>(
      '/productos/importar', form, { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  plantillaUrl: () => `${client.defaults.baseURL}/productos/importar/plantilla`,
  eliminarMasivo: (ids: number[]) =>
    client.post<ApiResponse<{ message: string }>>('/productos/eliminar-masivo', { ids }),
}

// ── Existencias ────────────────────────────────────────────────────────────
export const existenciasApi = {
  list:    (params: Record<string, unknown>) => list<Existencia>('/existencias', params),
  resumen: (empresaId: number) =>
    client.get<ApiResponse<unknown[]>>('/existencias/resumen-por-producto', { params: { empresa_id: empresaId } }),
}

// ── Movimientos ────────────────────────────────────────────────────────────
export const movimientosApi = {
  list:   (params: Record<string, unknown>) => list<Movimiento>('/movimientos', params),
  get:    (id: number) => get<Movimiento>(`/movimientos/${id}`),
  create: (data: unknown) => create<Movimiento>('/movimientos', data),
}

// ── Compras ────────────────────────────────────────────────────────────────
export const comprasApi = {
  list:     (params: Record<string, unknown>) => list<Compra>('/compras', params),
  get:      (id: number) => get<Compra>(`/compras/${id}`),
  create:   (data: unknown) => create<Compra>('/compras', data),
  recibir:  (id: number) => client.post<ApiResponse<Compra>>(`/compras/${id}/recibir`),
  cancelar: (id: number) => client.post<ApiResponse<Compra>>(`/compras/${id}/cancelar`),
  escanear: (imagen: string, media_type: string) =>
    client.post<ApiResponse<FacturaEscaneada>>('/compras/escanear-factura', { imagen, media_type }),
}

export interface FacturaEscaneada {
  proveedor:           string | null
  proveedor_rtn:       string | null
  proveedor_telefono:  string | null
  proveedor_correo:    string | null
  numero_factura:      string | null
  fecha:               string | null
  items: { codigo?: string | null; descripcion: string; cantidad: number; precio_unitario: number }[]
  subtotal:  number | null
  impuesto:  number | null
  descuento: number | null
  total:     number | null
}

// ── Cotizaciones ───────────────────────────────────────────────────────────
export const cotizacionesApi = {
  list:             (params: Record<string, unknown>) => list<Cotizacion>('/cotizaciones', params),
  get:              (id: number) => get<Cotizacion>(`/cotizaciones/${id}`),
  create:           (data: unknown) => create<Cotizacion>('/cotizaciones', data),
  update:           (id: number, data: unknown) => update<Cotizacion>(`/cotizaciones/${id}`, data),
  cambiarEstado:    (id: number, estado: string) => client.post<ApiResponse<Cotizacion>>(`/cotizaciones/${id}/estado`, { estado }),
  convertir:        (id: number, data: { bodega_id: number; fecha_venta?: string }) =>
    client.post<ApiResponse<Venta>>(`/cotizaciones/${id}/convertir`, data),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_cotizacion: string }>>('/cotizaciones/siguiente-numero', { params: { empresa_id: empresaId } }),
}

// ── Transferencias ────────────────────────────────────────────────────────
export const transferenciasApi = {
  list:   (params: Record<string, unknown>) => list<Transferencia>('/transferencias', params),
  get:    (id: number) => get<Transferencia>(`/transferencias/${id}`),
  create: (data: unknown) => create<Transferencia>('/transferencias', data),
}

// ── Reportes ───────────────────────────────────────────────────────────────
export const reportesApi = {
  ingresos:     (params: Record<string, unknown>) => client.get('/reportes/ingresos', { params }),
  topProductos: (params: Record<string, unknown>) => client.get('/reportes/top-productos', { params }),
  inventario:   (params: Record<string, unknown>) => client.get('/reportes/inventario', { params }),
}

// ── Sesiones de caja ──────────────────────────────────────────────────────
export const sesionCajaApi = {
  actual:  (empresa_id: number) => client.get<ApiResponse<SesionCaja | null>>('/caja/actual', { params: { empresa_id } }),
  abrir:   (data: { empresa_id: number; monto_inicial: number }) => client.post<ApiResponse<SesionCaja>>('/caja', data),
  cerrar:  (id: number, data: { monto_cierre: number; observaciones?: string }) => client.post<ApiResponse<SesionCaja>>(`/caja/${id}/cerrar`, data),
  list:    (params: Record<string, unknown>) => list<SesionCaja>('/caja', params),
}

// ── Ventas ─────────────────────────────────────────────────────────────────
export const ventasApi = {
  list:             (params: Record<string, unknown>) => list<Venta>('/ventas', params),
  get:              (id: number) => get<Venta>(`/ventas/${id}`),
  create:           (data: unknown) => create<Venta>('/ventas', data),
  cancelar:         (id: number) => client.post<ApiResponse<Venta>>(`/ventas/${id}/cancelar`),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_factura: string }>>('/ventas/siguiente-numero', { params: { empresa_id: empresaId } }),
}

// ── Comandas ───────────────────────────────────────────────────────────────
export const comandasApi = {
  list:             (params: Record<string, unknown>) => client.get<ApiResponse<Comanda[]>>('/comandas', { params }),
  create:           (data: unknown) => client.post<ApiResponse<Comanda>>('/comandas', data),
  actualizarEstado: (id: number, estado: string) => client.patch(`/comandas/${id}/estado`, { estado }),
  marcarItemListo:  (comandaId: number, detalleId: number, listo: boolean) =>
    client.patch<ApiResponse<Comanda>>(`/comandas/${comandaId}/detalles/${detalleId}/listo`, { listo }),
  facturar:         (id: number, data: unknown) => client.post(`/comandas/${id}/facturar`, data),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_comanda: string }>>('/comandas/siguiente-numero', { params: { empresa_id: empresaId } }),
}

// ── Mesas ─────────────────────────────────────────────────────────────────
export const mesasApi = {
  list:     (params: Record<string, unknown>) => client.get<ApiResponse<Mesa[]>>('/mesas', { params }),
  create:   (data: unknown) => create<Mesa>('/mesas', data),
  update:   (id: number, data: unknown) => update<Mesa>(`/mesas/${id}`, data),
  delete:   (id: number) => remove(`/mesas/${id}`),
  comandas: (id: number) => client.get<ApiResponse<Comanda[]>>(`/mesas/${id}/comandas`),
  facturar: (id: number, data: unknown) => client.post<ApiResponse<Venta>>(`/mesas/${id}/facturar`, data),
}

// ── Recetas ────────────────────────────────────────────────────────────────
export const recetasApi = {
  list:   (params: Record<string, unknown>) => list<Receta>('/recetas', params),
  get:    (id: number) => get<Receta>(`/recetas/${id}`),
  create: (data: unknown) => create<Receta>('/recetas', data),
  update: (id: number, data: unknown) => update<Receta>(`/recetas/${id}`, data),
  delete: (id: number) => remove(`/recetas/${id}`),
}
