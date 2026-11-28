// ── Auth ──────────────────────────────────────────────────────────────────
export interface Usuario {
  id: number
  nombre: string
  correo: string
  activo: boolean
  es_super_admin: boolean
  tiene_pin?: boolean
}

export type Rubro = 'tienda' | 'distribuidora' | 'farmacia' | 'ferreteria' | 'restaurante'

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'

export interface EmpresaResumen {
  id: number
  nombre: string
  rol: number
  logo_url?: string | null
  modulos: string[] | null  // null = acceso total; array = módulos permitidos
  rubro?: Rubro | null
}

export interface ConfigCotizacion {
  mostrar_descripcion: boolean
  mostrar_foto: boolean
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
  rubro?: Rubro | null
  logo_url?: string | null
  config_cotizacion?: ConfigCotizacion
  tipo_facturacion?: 'ticket' | 'factura_a4'
  cai?: string | null
  factura_rango_desde?: string | null
  factura_rango_hasta?: string | null
  factura_fecha_limite?: string | null
  color_primario?: string
  color_secundario?: string
  tiene_firma?: boolean
  tiene_sello?: boolean
  timeout_inactividad?: number
  dias_credito?: number   // plazo por defecto de las ventas al crédito
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
  departamento?: string
  municipio?: string
  activo: boolean
  dias_credito?: number | null   // null = usa el de la empresa
  saldo_pendiente?: number       // lo que se le debe (compras al crédito)
}

export interface Cliente {
  id: number
  empresa_id: number
  nombre: string
  rtn?: string
  correo?: string
  telefono?: string
  direccion?: string
  departamento?: string
  municipio?: string
  activo: boolean
  limite_credito?: number | null   // null = sin límite
  dias_credito?: number | null     // null = usa el de la empresa
  saldo_pendiente?: number
}

export interface Bodega {
  id: number
  empresa_id: number
  sucursal_id?: number
  codigo?: string
  nombre: string
  activo: boolean
  predeterminada: boolean
  sucursal?: { id: number; nombre: string }
}

// ── Productos ─────────────────────────────────────────────────────────────
export interface Producto {
  id: number
  empresa_id: number
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
  precio_incluye_isv: boolean
  stock_minimo: number
  maneja_lote: boolean
  maneja_vencimiento: boolean
  maneja_serie: boolean
  activo: boolean
  tipo: 'venta' | 'ingrediente'
  imagen_url?: string | null
  categorias?: { id: number; nombre: string }[]
  marca?: { id: number; nombre: string }
  unidad_medida?: { id: number; nombre: string; abreviatura: string }
  stock_total?: number
}

// ── Inventario ────────────────────────────────────────────────────────────
export interface Existencia {
  id: number
  bodega_id: number | null
  producto_id: number
  lote?: string
  fecha_vencimiento?: string
  numero_serie?: string
  cantidad: number
  cantidad_reservada: number
  cantidad_disponible: number
  /** Fila resumen de stock bajo (suma de todas las bodegas), no una existencia real */
  agregado?: boolean
  producto?: {
    id: number
    codigo?: string
    nombre: string
    imagen_url?: string | null
    stock_minimo: number
    stock_bajo: boolean
  }
  bodega?: { id: number | null; nombre: string }
}

export type TipoMovimiento = 'entrada' | 'salida'

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
  cantidad_devuelta?: number
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
  costo_envio?: number
  condicion?: CondicionVenta
  metodo_pago?: MetodoPagoCompra | null
  tarjeta_credito_id?: number | null
  tarjeta?: TarjetaResumen | null
  requisicion_id?: number | null
  requisicion?: string | null
  dias_credito?: number | null
  fecha_vencimiento?: string | null
  saldo_pendiente?: number
  total_pagado?: number
  estado_pago?: EstadoPago | null
  dias_vencida?: number
  pagos?: PagoCompra[]
  monto_devuelto?: number
  motivo_cancelacion?: string | null
  cancelada_at?: string | null
  cancelada_por?: string | null
  devoluciones?: DevolucionCompra[]
  proveedor?: { id: number; nombre: string; rtn?: string | null }
  bodega?: { id: number; nombre: string }
  detalles?: DetalleCompra[]
}

// ── Devoluciones ──────────────────────────────────────────────────────────
export type ReembolsoMetodo = 'efectivo' | 'tarjeta' | 'transferencia' | 'cambio'

// ── Tarjetas de crédito de la empresa ─────────────────────────────────────
export interface TarjetaResumen { id: number; nombre: string; banco: string; ultimos4: string; etiqueta: string }

export interface TarjetaCredito extends TarjetaResumen {
  dia_corte: number | null
  dia_pago: number | null
  limite: number | null
  activo: boolean
  saldo: number
  disponible: number | null
  ultimo_corte: string | null
  proximo_corte: string | null
  fecha_pago: string | null
  cargado_periodo: number | null
}

export interface MovimientoTarjeta {
  tipo: 'cargo' | 'pago'
  id: number
  fecha: string
  monto: number
  descripcion: string
  origen: string
  anulado: boolean
  usuario?: string | null
  saldo: number
}

// ── Bancos ───────────────────────────────────────────────────────────────
export type Moneda = 'HNL' | 'USD'

export interface CuentaBancaria {
  id: number
  banco: string
  nombre: string
  tipo: 'corriente' | 'ahorro'
  ultimos4: string
  moneda: Moneda
  etiqueta: string
  saldo_inicial: number
  fecha_saldo_inicial: string | null
  comision_pos_pct: number | null
  activo: boolean
  saldo: number
}

export interface MovimientoBanco {
  id: number
  fecha: string
  tipo: 'entrada' | 'salida'
  monto: number
  descripcion: string
  origen: string
  referencia?: string | null
  categoria?: string | null
  conciliado: boolean
  anulado: boolean
  usuario?: string | null
  saldo: number
}

export interface CategoriaBanco { id: number; nombre: string; tipo: 'entrada' | 'salida' | 'ambos'; activo: boolean }

export interface DefectosBanco { cuenta_tarjeta_id?: number; cuenta_transferencia_id?: number; cuenta_pagos_id?: number }

export interface RequisicionConTarjeta {
  id: number
  numero_requisicion: string
  fecha: string
  total: number
  tarjeta_credito_id: number
  tarjeta: TarjetaResumen | null
}

export interface DetalleDevolucion {
  id: number
  producto_id?: number | null
  nombre?: string | null
  codigo?: string | null
  cantidad: number
  precio: number
  subtotal: number
  regresa_a_stock?: boolean
}

interface DevolucionBase {
  id: number
  numero: string
  numero_factura?: string | null
  bodega?: string | null
  usuario?: string | null
  fecha: string
  motivo: string
  subtotal: number
  impuesto: number
  total: number
  aplicado_a_saldo: number
  reembolsado: number
  reembolso_metodo?: ReembolsoMetodo | null
  desde_caja: boolean
  detalles?: DetalleDevolucion[]
  created_at?: string
}

export interface DevolucionVenta extends DevolucionBase {
  venta_id: number
  cliente?: { id: number; nombre: string; rtn?: string | null } | null
}

export interface DevolucionCompra extends DevolucionBase {
  compra_id: number
  proveedor?: { id: number; nombre: string; rtn?: string | null } | null
}

export interface NuevaDevolucion {
  motivo: string
  fecha?: string
  reembolso_metodo?: ReembolsoMetodo | null
  desde_caja?: boolean
  cuenta_bancaria_id?: number | null
  lineas: { detalle_id: number; cantidad: number }[]
}

// ── Compras al crédito (cuentas por pagar) ────────────────────────────────
export type MetodoPagoCompra = 'efectivo' | 'debito' | 'tarjeta' | 'transferencia' | 'cheque'

export interface PagoCompra {
  id: number
  compra_id: number
  proveedor_id?: number | null
  fecha: string
  monto: number
  metodo_pago: MetodoPagoCompra
  desde_caja: boolean
  tarjeta_credito_id?: number | null
  referencia?: string | null
  observaciones?: string | null
  anulado: boolean
  anulado_at?: string | null
  usuario?: string | null
  numero_factura?: string | null
  proveedor?: string | null
  created_at?: string
}

export interface CuentaProveedor extends AntiguedadSaldos {
  proveedor_id: number | null
  nombre: string
  rtn?: string | null
  telefono?: string | null
  facturas: number
  vence_primero: string | null
}

export interface ResumenCxP {
  totales: AntiguedadSaldos & { proveedores: number; facturas: number; vence_7_dias: number }
  proveedores: CuentaProveedor[]
}

export interface EstadoCuentaProveedor {
  proveedor: { id: number; nombre: string; rtn?: string | null; telefono?: string | null; correo?: string | null; dias_credito: number }
  resumen: AntiguedadSaldos & { facturas: number }
  facturas: Compra[]
  pagos: PagoCompra[]
}

export interface NuevoPagoCompra {
  monto: number
  fecha?: string
  metodo_pago: MetodoPagoCompra
  desde_caja?: boolean
  tarjeta_credito_id?: number | null
  cuenta_bancaria_id?: number | null
  referencia?: string | null
  observaciones?: string | null
}

// ── Cotizaciones ──────────────────────────────────────────────────────────
export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'convertida' | 'vencida'

export interface DetalleCotizacion {
  id: number
  /** null = artículo libre (usa `descripcion`) */
  producto_id: number | null
  descripcion?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto?: { id: number; codigo?: string; nombre: string; descripcion?: string | null; imagen_url?: string | null }
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
  autorizado?: boolean
  autorizado_por?: string | null
  autorizado_at?: string | null
  cliente?: { id: number; nombre: string }
  detalles?: DetalleCotizacion[]
}

// ── Ventas ────────────────────────────────────────────────────────────────
export type EstadoVenta = 'completada' | 'cancelada'

export interface DetalleVenta {
  id: number
  producto_id?: number | null
  receta_id?: number | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto?: string | null
  codigo?: string | null
  unidad?: string | null
  tasa_isv?: number | null
  receta?: string | null
  descripcion?: string | null
  cantidad_devuelta?: number
}

// ── Firma y sello de documentos autorizados ──────────────────────────────
export interface DatosFirma {
  firma: string | null
  sello: string | null
  autorizado_por: string | null
  autorizado_at: string
}

// ── Requisiciones ─────────────────────────────────────────────────────────
export type EstadoRequisicion = 'borrador' | 'enviada' | 'recibida' | 'cancelada'

export interface DetalleRequisicion {
  id: number
  /** null = artículo libre */
  producto_id: number | null
  codigo: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  tasa_isv: number | null
  imagen_url: string | null
}

export interface Requisicion {
  id: number
  empresa_id: number
  proveedor_id: number | null
  numero_requisicion: string
  fecha_requisicion: string
  realizado_por: string | null
  condicion: 'credito' | 'contado' | null
  metodo_pago?: MetodoPagoCompra | null
  tarjeta_credito_id?: number | null
  tarjeta?: TarjetaResumen | null
  observaciones: string | null
  subtotal: number
  impuesto: number
  total: number
  estado: EstadoRequisicion
  total_articulos?: number
  autorizado?: boolean
  autorizado_por?: string | null
  autorizado_at?: string | null
  proveedor?: { id: number; nombre: string; rtn?: string | null; telefono?: string | null; correo?: string | null; direccion?: string | null } | null
  detalles?: DetalleRequisicion[]
  created_at?: string
}

// ── Recetas ───────────────────────────────────────────────────────────────
export interface RecetaIngrediente {
  id: number
  producto_id: number
  producto?: string
  unidad?: string | null
  cantidad: number
  costo_unit: number
}

export interface Receta {
  id: number
  empresa_id: number
  nombre: string
  descripcion?: string | null
  precio_venta: number
  activo: boolean
  ingredientes: RecetaIngrediente[]
  costo_total?: number | null
}

// ── Mesas ─────────────────────────────────────────────────────────────────
export interface Mesa {
  id: number
  empresa_id: number
  nombre: string
  capacidad?: number | null
  activo: boolean
  estado: 'libre' | 'ocupada' | 'lista'
  comandas_activas: number
  comandas_listas: number
}

// ── Comandas ──────────────────────────────────────────────────────────────
export interface DetalleComanda {
  id: number
  producto_id?: number | null
  receta_id?: number | null
  nombre_item: string
  cantidad: number
  precio_unitario: number
  notas?: string | null
  listo: boolean
}

export interface Comanda {
  id: number
  empresa_id: number
  bodega_id: number
  mesa_id?: number | null
  numero_comanda: string
  mesa?: string | null
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'cancelado'
  observaciones?: string | null
  created_at: string
  detalles: DetalleComanda[]
}

export interface Venta {
  id: number
  empresa_id: number
  cliente_id?: number
  bodega_id: number
  usuario_id: number
  numero_factura?: string
  // Datos del CAI vigentes al emitir la factura
  cai?: string | null
  cai_rango_desde?: string | null
  cai_rango_hasta?: string | null
  cai_fecha_limite?: string | null
  fecha_venta: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: EstadoVenta
  metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto' | null
  condicion?: CondicionVenta
  dias_credito?: number | null
  fecha_vencimiento?: string | null
  saldo_pendiente?: number
  total_abonado?: number
  estado_pago?: EstadoPago | null
  dias_vencida?: number
  abonos?: AbonoVenta[]
  monto_devuelto?: number
  motivo_cancelacion?: string | null
  cancelada_at?: string | null
  cancelada_por?: string | null
  devoluciones?: DevolucionVenta[]
  costo_envio?: number
  exonerado?: boolean
  orden_compra_exenta?: string | null
  constancia_exonerado?: string | null
  registro_sag?: string | null
  vendedor?: string | null
  cliente?: { id: number; nombre: string; rtn?: string | null; direccion?: string | null; telefono?: string | null } | null
  bodega?: { id: number; nombre: string }
  detalles?: DetalleVenta[]
}

// ── Ventas al crédito ─────────────────────────────────────────────────────
export type CondicionVenta = 'contado' | 'credito'
export type EstadoPago = 'pendiente' | 'vencida' | 'pagada' | 'cancelada'
export type MetodoAbono = 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque'

export interface AbonoVenta {
  id: number
  venta_id: number
  cliente_id?: number | null
  fecha: string
  monto: number
  metodo_pago: MetodoAbono
  referencia?: string | null
  observaciones?: string | null
  anulado: boolean
  anulado_at?: string | null
  usuario?: string | null
  numero_factura?: string | null
  cliente?: string | null
  created_at?: string
}

export interface AntiguedadSaldos {
  saldo: number
  al_dia: number
  vencido: number
  d1_30: number
  d31_60: number
  d61_90: number
  d90_mas: number
}

export interface CuentaCliente extends AntiguedadSaldos {
  cliente_id: number | null
  nombre: string
  rtn?: string | null
  telefono?: string | null
  limite_credito: number | null
  facturas: number
  vence_primero: string | null
}

export interface ResumenCxC {
  totales: AntiguedadSaldos & { clientes: number; facturas: number }
  clientes: CuentaCliente[]
}

export interface EstadoCuenta {
  cliente: {
    id: number; nombre: string; rtn?: string | null; telefono?: string | null; correo?: string | null
    direccion?: string | null; limite_credito: number | null; dias_credito: number
  }
  resumen: AntiguedadSaldos & { facturas: number }
  facturas: Venta[]
  abonos: AbonoVenta[]
}

export interface NuevoAbono {
  monto: number
  fecha?: string
  metodo_pago: MetodoAbono
  referencia?: string | null
  observaciones?: string | null
  cuenta_bancaria_id?: number | null
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardData {
  resumen: {
    total_productos: number
    total_proveedores: number
    productos_stock_bajo: number
    compras_mes: number
    ventas_mes: number
    ventas_mes_anterior: number
    variacion_ventas_pct: number | null
    margen_bruto_mes: number
    margen_pct: number
    valor_inventario: number
    compras_pendientes_count: number
    compras_pendientes_monto: number
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

export interface ProductoPendiente {
  id: number
  codigo: string | null
  nombre: string
  pendientes: string[]
  stock: number
  costo: number
  grupo: string | null
  created_at: string | null
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
  rubro?: Rubro | null
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
  modulos: string[] | null
  asignaciones: number
}

export interface UsuarioEmpresaItem {
  empresa_id: number
  empresa_nombre: string
  rol_id: number
  rol_nombre: string
  activo: boolean
}

// ── Sesión de caja ───────────────────────────────────────────────────────
export interface SesionCaja {
  id: number
  empresa_id: number
  usuario?: { id: number; nombre: string } | null
  monto_inicial: number
  monto_cierre?: number | null
  diferencia?: number | null
  total_ventas?: number | null
  total_efectivo?: number | null
  total_tarjeta?: number | null
  total_transferencia?: number | null
  total_mixto?: number | null
  cantidad_ventas?: number | null
  total_credito?: number | null
  total_abonos?: number | null
  total_abonos_efectivo?: number | null
  total_pagos_proveedores?: number | null
  total_reembolsos_clientes?: number | null
  total_reembolsos_proveedores?: number | null
  estado: 'abierta' | 'cerrada'
  fecha_apertura: string
  fecha_cierre?: string | null
  observaciones?: string | null
  resumen?: {
    total_ventas: number
    cantidad_ventas: number
    por_metodo: { efectivo: number; tarjeta: number; transferencia: number; mixto: number }
    credito: { total: number; cantidad: number }
    abonos: { total: number; cantidad: number; por_metodo: Record<MetodoAbono, number> }
    pagos_proveedores?: { total: number; cantidad: number }
    reembolsos?: { clientes: number; proveedores: number }
    pagos_tarjetas?: number
    depositos_banco?: number
    efectivo_esperado: number
  }
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

// ── Bitácora ────────────────────────────────────────────────────────────────
export interface CambioBitacora {
  campo: string
  etiqueta: string
  antes: unknown
  despues: unknown
}

export interface Bitacora {
  id: number
  fecha: string
  usuario: { id: number; nombre: string } | null
  empresa?: { id: number; nombre: string } | null
  modulo: string
  accion: string
  descripcion: string | null
  entidad_tipo: string | null
  entidad_id: number | null
  ip: string | null
  cambios: CambioBitacora[]
}
