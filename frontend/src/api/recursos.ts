import client from './client'
import type {
  PaginatedResponse, ApiResponse,
  Categoria, Marca, UnidadMedida, Proveedor, Cliente, Bodega,
  Producto, Existencia, DashboardData, Movimiento, Compra, Venta,
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

// ── Ventas ─────────────────────────────────────────────────────────────────
export const ventasApi = {
  list:     (params: Record<string, unknown>) => list<Venta>('/ventas', params),
  get:      (id: number) => get<Venta>(`/ventas/${id}`),
  create:   (data: unknown) => create<Venta>('/ventas', data),
  cancelar: (id: number) => client.post<ApiResponse<Venta>>(`/ventas/${id}/cancelar`),
}
