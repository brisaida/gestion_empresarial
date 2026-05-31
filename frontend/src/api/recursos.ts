import client from './client'
import type {
  PaginatedResponse, ApiResponse,
  Categoria, Marca, UnidadMedida, Proveedor, Cliente, Bodega,
  Producto, Existencia, DashboardData, Movimiento, Compra, Venta, Cotizacion,
  EmpresaConfig,
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
  list:    (params: Record<string, unknown>) => list<Bodega>('/bodegas', params),
  get:     (id: number) => get<Bodega>(`/bodegas/${id}`),
  create:  (data: unknown) => create<Bodega>('/bodegas', data),
  update:  (id: number, data: unknown) => update<Bodega>(`/bodegas/${id}`, data),
  delete:  (id: number) => remove(`/bodegas/${id}`),
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

// ── Ventas ─────────────────────────────────────────────────────────────────
export const ventasApi = {
  list:             (params: Record<string, unknown>) => list<Venta>('/ventas', params),
  get:              (id: number) => get<Venta>(`/ventas/${id}`),
  create:           (data: unknown) => create<Venta>('/ventas', data),
  cancelar:         (id: number) => client.post<ApiResponse<Venta>>(`/ventas/${id}/cancelar`),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_factura: string }>>('/ventas/siguiente-numero', { params: { empresa_id: empresaId } }),
}
