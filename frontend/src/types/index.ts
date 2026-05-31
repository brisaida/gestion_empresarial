// ── Auth ──────────────────────────────────────────────────────────────────
export interface Usuario {
  id: number
  nombre: string
  correo: string
  activo: boolean
  es_super_admin: boolean
}

export interface EmpresaResumen {
  id: number
  nombre: string
  rol: number
  logo_url?: string | null
}

export interface EmpresaConfig {
  id: number
  nombre: string
  nombre_legal?: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  isv_rate?: number
  logo_url?: string | null
}

export interface AuthState {
  token: string | null
  usuario: Usuario | null
  empresas: EmpresaResumen[]
  empresaActiva: EmpresaResumen | null
}

// ── Empresa ───────────────────────────────────────────────────────────────
export interface Empresa {
  id: number
  nombre: string
  nombre_legal: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  logo?: string
  activo: boolean
}

// ── Catálogos ─────────────────────────────────────────────────────────────
export interface Categoria {
  id: number
  empresa_id: number
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface Marca {
  id: number
  empresa_id: number
  nombre: string
  activo: boolean
}

export interface UnidadMedida {
  id: number
  empresa_id: number
  nombre: string
  abreviatura: string
  activo: boolean
}

export interface Proveedor {
  id: number
  empresa_id: number
  nombre: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  activo: boolean
}

export interface Cliente {
  id: number
  empresa_id: number
  nombre: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  activo: boolean
}

export interface Bodega {
  id: number
  empresa_id: number
  sucursal_id?: number
  codigo?: string
  nombre: string
  activo: boolean
  sucursal?: { id: number; nombre: string }
}

// ── Productos ─────────────────────────────────────────────────────────────
export interface Producto {
  id: number
  empresa_id: number
  categoria_id?: number
  marca_id?: number
  unidad_medida_id?: number
  codigo?: string
  codigo_barra?: string
  nombre: string
  descripcion?: string
  tamaño?: string | null
  peso?: number | null
  largo?: number | null
  ancho?: number | null
  alto?: number | null
  costo: number
  precio_venta: number
  tasa_isv: number | null
  stock_minimo: number
  maneja_lote: boolean
  maneja_vencimiento: boolean
  maneja_serie: boolean
  activo: boolean
  imagen_url?: string | null
  categoria?: { id: number; nombre: string }
  marca?: { id: number; nombre: string }
  unidad_medida?: { id: number; nombre: string; abreviatura: string }
  stock_total?: number
}

// ── Inventario ────────────────────────────────────────────────────────────
export interface Existencia {
  id: number
  bodega_id: number
  producto_id: number
  lote?: string
  fecha_vencimiento?: string
  numero_serie?: string
  cantidad: number
  cantidad_reservada: number
  cantidad_disponible: number
  producto?: {
    id: number
    codigo?: string
    nombre: string
    stock_minimo: number
    stock_bajo: boolean
  }
  bodega?: { id: number; nombre: string }
}

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo'

export interface DetalleMovimiento {
  id: number
  producto_id: number
  cantidad: number
  costo_unitario?: number
  lote?: string
  fecha_vencimiento?: string
  numero_serie?: string
  producto?: { id: number; codigo?: string; nombre: string }
}

export interface Movimiento {
  id: number
  empresa_id: number
  bodega_id: number
  usuario_id: number
  tipo_movimiento: TipoMovimiento
  numero_documento?: string
  fecha: string
  observaciones?: string
  bodega?: { id: number; nombre: string }
  usuario?: { id: number; nombre: string }
  detalles?: DetalleMovimiento[]
}

// ── Compras ───────────────────────────────────────────────────────────────
export type EstadoCompra = 'pendiente' | 'recibida' | 'cancelada'

export interface DetalleCompra {
  id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  subtotal: number
  lote?: string
  fecha_vencimiento?: string
  producto?: { id: number; codigo?: string; nombre: string }
}

export interface Compra {
  id: number
  empresa_id: number
  proveedor_id: number
  bodega_id: number
  usuario_id: number
  numero_factura?: string
  fecha_compra: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: EstadoCompra
  proveedor?: { id: number; nombre: string }
  bodega?: { id: number; nombre: string }
  detalles?: DetalleCompra[]
}

// ── Cotizaciones ──────────────────────────────────────────────────────────
export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'convertida' | 'vencida'

export interface DetalleCotizacion {
  id: number
  producto_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto?: { id: number; codigo?: string; nombre: string }
}

export interface Cotizacion {
  id: number
  empresa_id: number
  cliente_id?: number
  usuario_id: number
  venta_id?: number
  numero_cotizacion: string
  fecha_cotizacion: string
  fecha_vencimiento?: string
  observaciones?: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: EstadoCotizacion
  cliente?: { id: number; nombre: string }
  detalles?: DetalleCotizacion[]
}

// ── Ventas ────────────────────────────────────────────────────────────────
export type EstadoVenta = 'completada' | 'cancelada'

export interface DetalleVenta {
  id: number
  producto_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto?: { id: number; codigo?: string; nombre: string }
}

export interface Venta {
  id: number
  empresa_id: number
  cliente_id?: number
  bodega_id: number
  usuario_id: number
  numero_factura?: string
  fecha_venta: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: EstadoVenta
  cliente?: { id: number; nombre: string }
  bodega?: { id: number; nombre: string }
  detalles?: DetalleVenta[]
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardData {
  resumen: {
    total_productos: number
    total_proveedores: number
    productos_stock_bajo: number
    compras_mes: number
    ventas_mes: number
  }
  ultimas_ventas: Array<{
    id: number
    cliente: string
    total: number
    fecha_venta: string
  }>
  top_productos: Array<{
    producto_id: number
    nombre: string
    total_vendido: number
  }>
}

// ── Traslados ─────────────────────────────────────────────────────────────
export type EstadoTraslado = 'pendiente' | 'completada' | 'cancelada'

export interface DetalleTransferencia {
  id: number
  producto_id: number
  cantidad: number
  lote?: string
  fecha_vencimiento?: string
  numero_serie?: string
  producto?: { id: number; codigo?: string; nombre: string }
}

export interface Transferencia {
  id: number
  empresa_id: number
  bodega_origen_id: number
  bodega_destino_id: number
  usuario_id: number
  fecha_transferencia: string
  estado: EstadoTraslado
  observaciones?: string
  bodega_origen?: string
  bodega_destino?: string
  detalles?: DetalleTransferencia[]
}

// ── Super Admin ───────────────────────────────────────────────────────────
export interface SaDashboardData {
  stats: {
    total_empresas:   number
    empresas_activas: number
    total_usuarios:   number
    usuarios_activos: number
    super_admins:     number
    total_roles:      number
  }
  empresas_recientes: Array<{
    id: number
    nombre: string
    nombre_legal?: string
    activo: boolean
    usuarios_count: number
    created_at: string
  }>
  usuarios_recientes: Array<{
    id: number
    nombre: string
    correo: string
    activo: boolean
    es_super_admin: boolean
    created_at: string
  }>
}

export interface EmpresaAdmin {
  id: number
  nombre: string
  nombre_legal?: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  activo: boolean
  usuarios_count: number
  created_at: string
}

export interface UsuarioAdmin {
  id: number
  nombre: string
  correo: string
  activo: boolean
  es_super_admin: boolean
  empresas_count: number
  created_at: string
}

export interface RolSimple {
  id: number
  nombre: string
}

export interface RolAdmin {
  id: number
  nombre: string
  descripcion?: string
  asignaciones: number
}

export interface UsuarioEmpresaItem {
  empresa_id: number
  empresa_nombre: string
  rol_id: number
  rol_nombre: string
  activo: boolean
}

// ── API response wrappers ─────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    per_page?: number
    current_page: number
    last_page: number
  }
}
