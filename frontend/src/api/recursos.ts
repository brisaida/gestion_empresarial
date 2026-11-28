import client from './client'
import type {
  PaginatedResponse, ApiResponse,
  Categoria, Marca, UnidadMedida, Proveedor, Cliente, Bodega,
  Producto, Existencia, DashboardData, ProductoPendiente, Movimiento, Compra, Venta, Cotizacion,
  Transferencia, EmpresaConfig, Receta, Comanda, Mesa, SesionCaja, Requisicion, DatosFirma, MetodoPago,
  CondicionVenta, AbonoVenta, ResumenCxC, EstadoCuenta, NuevoAbono,
  MetodoPagoCompra, PagoCompra, ResumenCxP, EstadoCuentaProveedor, NuevoPagoCompra,
  DevolucionVenta, DevolucionCompra, NuevaDevolucion,
  TarjetaCredito, MovimientoTarjeta, RequisicionConTarjeta,
  CuentaBancaria, MovimientoBanco, CategoriaBanco, DefectosBanco, TarjetaResumen, Moneda,
  Bitacora,
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
  firmaSello: (empresaId: number) =>
    client.get<ApiResponse<{ firma: string | null; sello: string | null }>>('/empresa/firma-sello', { params: { empresa_id: empresaId } }),
  uploadFirmaSello: (empresaId: number, tipo: 'firma' | 'sello', file: File) => {
    const form = new FormData()
    form.append('imagen', file)
    form.append('empresa_id', String(empresaId))
    return client.post<ApiResponse<Record<string, string>>>(`/empresa/${tipo}/imagen`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteFirmaSello: (empresaId: number, tipo: 'firma' | 'sello') =>
    client.delete(`/empresa/${tipo}/imagen`, { params: { empresa_id: empresaId } }),
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
  productosPendientes: (empresaId: number) =>
    client.get<ApiResponse<ProductoPendiente[]>>('/dashboard/productos-pendientes', { params: { empresa_id: empresaId } }),
}

// ── Categorías ─────────────────────────────────────────────────────────────
export const categoriasApi = {
  list:    (params: Record<string, unknown>) => list<Categoria>('/categorias', params),
  get:     (id: number) => get<Categoria>(`/categorias/${id}`),
  create:  (data: unknown) => create<Categoria>('/categorias', data),
  update:  (id: number, data: unknown) => update<Categoria>(`/categorias/${id}`, data),
  delete:  (id: number) => remove(`/categorias/${id}`),
  importar: (empresaId: number, file: File) => {
    const form = new FormData()
    form.append('empresa_id', String(empresaId))
    form.append('archivo', file)
    return client.post<ApiResponse<{ creados: number; omitidas: number; errores: { fila: number; error: string }[] }>>(
      '/categorias/importar', form, { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  plantillaUrl: () => `${client.defaults.baseURL}/categorias/importar/plantilla`,
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
    return client.post<ApiResponse<{ creados: number; omitidos: number; errores: { fila: number; error: string }[]; sin_bodega: boolean }>>(
      '/productos/importar', form, { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  plantillaUrl: (empresaId: number) => `${client.defaults.baseURL}/productos/importar/plantilla?empresa_id=${empresaId}`,
  eliminar: (id: number, descartarExistencias: boolean) =>
    client.delete<ApiResponse<null>>(`/productos/${id}`, { params: { descartar_existencias: descartarExistencias ? 1 : 0 } }),
  unir: (origenId: number, destinoId: number) =>
    client.post<ApiResponse<{ unidades_pasadas: number; costo_final: number }>>(`/productos/${origenId}/unir`, { destino_id: destinoId }),
  eliminarMasivo: (ids: number[], descartarExistencias: boolean) =>
    client.post<ApiResponse<{ message: string }>>('/productos/eliminar-masivo', { ids, descartar_existencias: descartarExistencias }),
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
  cancelar: (id: number, motivo: string) => client.post<ApiResponse<Compra>>(`/compras/${id}/cancelar`, { motivo }),
  devolver: (id: number, data: NuevaDevolucion) => client.post<ApiResponse<DevolucionCompra>>(`/compras/${id}/devoluciones`, data),
  cambiarCondicion: (id: number, data: { condicion: CondicionVenta; metodo_pago?: MetodoPagoCompra | null; dias_credito?: number | null; tarjeta_credito_id?: number | null; requisicion_id?: number | null; cuenta_bancaria_id?: number | null }) =>
    client.patch<ApiResponse<Compra>>(`/compras/${id}/condicion`, data),
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
  autorizar:        (id: number, pin: string) => client.post<ApiResponse<Cotizacion>>(`/cotizaciones/${id}/autorizar`, { pin }),
  firma:            (id: number) => client.get<ApiResponse<DatosFirma | null>>(`/cotizaciones/${id}/firma`),
  convertir:        (id: number, data: { bodega_id: number; fecha_venta?: string; metodo_pago?: MetodoPago; condicion?: CondicionVenta; dias_credito?: number | null }) =>
    client.post<ApiResponse<Venta>>(`/cotizaciones/${id}/convertir`, data),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_cotizacion: string }>>('/cotizaciones/siguiente-numero', { params: { empresa_id: empresaId } }),
}

// ── Requisiciones ─────────────────────────────────────────────────────────
export const requisicionesApi = {
  list:            (params: Record<string, unknown>) => list<Requisicion>('/requisiciones', params),
  get:             (id: number) => get<Requisicion>(`/requisiciones/${id}`),
  create:          (data: unknown) => create<Requisicion>('/requisiciones', data),
  formaPago:       (id: number, data: { metodo_pago: MetodoPagoCompra | null; tarjeta_credito_id?: number | null }) =>
    client.patch<ApiResponse<Requisicion>>(`/requisiciones/${id}/forma-pago`, data),
  update:          (id: number, data: unknown) => update<Requisicion>(`/requisiciones/${id}`, data),
  cambiarEstado:   (id: number, estado: string) => client.post<ApiResponse<Requisicion>>(`/requisiciones/${id}/estado`, { estado }),
  autorizar:       (id: number, pin: string) => client.post<ApiResponse<Requisicion>>(`/requisiciones/${id}/autorizar`, { pin }),
  firma:           (id: number) => client.get<ApiResponse<DatosFirma | null>>(`/requisiciones/${id}/firma`),
  siguienteNumero: (empresaId: number) =>
    client.get<ApiResponse<{ numero_requisicion: string }>>('/requisiciones/siguiente-numero', { params: { empresa_id: empresaId } }),
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
  cancelar:         (id: number, motivo: string) => client.post<ApiResponse<Venta>>(`/ventas/${id}/cancelar`, { motivo }),
  devolver:         (id: number, data: NuevaDevolucion) => client.post<ApiResponse<DevolucionVenta>>(`/ventas/${id}/devoluciones`, data),
  siguienteNumero:  (empresaId: number) =>
    client.get<ApiResponse<{ numero_factura: string | null; aviso: string | null; bloqueado: boolean }>>('/ventas/siguiente-numero', { params: { empresa_id: empresaId } }),
}

// ── Cuentas por cobrar (ventas al crédito) ──────────────────────────────────
export const cxcApi = {
  resumen:      (params: Record<string, unknown>) =>
    client.get<ApiResponse<ResumenCxC>>('/cuentas-por-cobrar', { params }),
  estadoCuenta: (clienteId: number) =>
    client.get<ApiResponse<EstadoCuenta>>(`/cuentas-por-cobrar/clientes/${clienteId}`),
  abonarCliente: (clienteId: number, data: NuevoAbono) =>
    client.post<ApiResponse<AbonoVenta[]>>(`/cuentas-por-cobrar/clientes/${clienteId}/abonos`, data),
  abonar:       (ventaId: number, data: NuevoAbono) =>
    client.post<ApiResponse<AbonoVenta>>(`/ventas/${ventaId}/abonos`, data),
  anular:       (abonoId: number) =>
    client.post<ApiResponse<AbonoVenta>>(`/abonos/${abonoId}/anular`),
  abonos:       (params: Record<string, unknown>) => list<AbonoVenta>('/abonos', params),
}

// ── Cuentas por pagar (compras al crédito) ─────────────────────────────────
export const cxpApi = {
  resumen:        (params: Record<string, unknown>) =>
    client.get<ApiResponse<ResumenCxP>>('/cuentas-por-pagar', { params }),
  estadoCuenta:   (proveedorId: number) =>
    client.get<ApiResponse<EstadoCuentaProveedor>>(`/cuentas-por-pagar/proveedores/${proveedorId}`),
  pagarProveedor: (proveedorId: number, data: NuevoPagoCompra) =>
    client.post<ApiResponse<PagoCompra[]>>(`/cuentas-por-pagar/proveedores/${proveedorId}/pagos`, data),
  pagar:          (compraId: number, data: NuevoPagoCompra) =>
    client.post<ApiResponse<PagoCompra>>(`/compras/${compraId}/pagos`, data),
  anular:         (pagoId: number) =>
    client.post<ApiResponse<PagoCompra>>(`/pagos-compra/${pagoId}/anular`),
  pagos:          (params: Record<string, unknown>) => list<PagoCompra>('/pagos-compra', params),
}

// ── Tarjetas de crédito ──────────────────────────────────────────────────
export const tarjetasApi = {
  list:        (empresa_id: number, todas = false) =>
    client.get<ApiResponse<TarjetaCredito[]>>('/tarjetas-credito', { params: { empresa_id, todas: todas ? 1 : undefined } }),
  create:      (data: unknown) => client.post<ApiResponse<TarjetaCredito>>('/tarjetas-credito', data),
  update:      (id: number, data: unknown) => client.put<ApiResponse<TarjetaCredito>>(`/tarjetas-credito/${id}`, data),
  movimientos: (id: number, params: Record<string, unknown>) =>
    client.get<ApiResponse<{ tarjeta: TarjetaCredito; saldo_inicial: number; movimientos: MovimientoTarjeta[] }>>(`/tarjetas-credito/${id}/movimientos`, { params }),
  pagar:       (id: number, data: unknown) => client.post<ApiResponse<TarjetaCredito>>(`/tarjetas-credito/${id}/pagos`, data),
  cargo:       (id: number, data: unknown) => client.post<ApiResponse<TarjetaCredito>>(`/tarjetas-credito/${id}/cargos`, data),
  anularPago:  (pagoId: number) => client.post(`/pagos-tarjeta/${pagoId}/anular`),
  anularCargo: (cargoId: number) => client.post(`/cargos-tarjeta/${cargoId}/anular`),
  requisicionesPendientes: (empresa_id: number, proveedor_id?: number | null) =>
    client.get<ApiResponse<RequisicionConTarjeta[]>>('/requisiciones-con-tarjeta', { params: { empresa_id, proveedor_id: proveedor_id || undefined } }),
}

// ── Bancos ─────────────────────────────────────────────────────────────────
export const bancosApi = {
  cuentas:       (empresa_id: number, todas = false) =>
    client.get<ApiResponse<{ cuentas: CuentaBancaria[]; totales: Partial<Record<Moneda, number>> }>>('/cuentas-bancarias', { params: { empresa_id, todas: todas ? 1 : undefined } }),
  crear:         (data: unknown) => client.post<ApiResponse<CuentaBancaria>>('/cuentas-bancarias', data),
  actualizar:    (id: number, data: unknown) => client.put<ApiResponse<CuentaBancaria>>(`/cuentas-bancarias/${id}`, data),
  movimientos:   (id: number, params: Record<string, unknown>) =>
    client.get<ApiResponse<{ cuenta: CuentaBancaria; saldo_inicial: number; movimientos: MovimientoBanco[]; sin_conciliar: { cantidad: number; neto: number } }>>(`/cuentas-bancarias/${id}/movimientos`, { params }),
  movimiento:    (id: number, data: unknown) => client.post(`/cuentas-bancarias/${id}/movimientos`, data),
  depositoCaja:  (id: number, data: unknown) => client.post(`/cuentas-bancarias/${id}/deposito-caja`, data),
  transferir:    (data: unknown) => client.post('/bancos/transferencias', data),
  anular:        (movId: number) => client.post(`/movimientos-banco/${movId}/anular`),
  conciliar:     (movId: number, conciliado: boolean) => client.post(`/movimientos-banco/${movId}/conciliar`, { conciliado }),
  configuracion: (empresa_id: number) =>
    client.get<ApiResponse<{ defectos: DefectosBanco; categorias: CategoriaBanco[] }>>('/bancos/configuracion', { params: { empresa_id } }),
  guardarDefectos: (data: unknown) => client.put('/bancos/configuracion', data),
  guardarCategoria: (data: unknown, id?: number) => id ? client.put(`/bancos/categorias/${id}`, data) : client.post('/bancos/categorias', data),
  opciones:      (empresa_id: number, todasMonedas = false) =>
    client.get<ApiResponse<{ cuentas: { id: number; etiqueta: string; moneda: Moneda }[]; defectos: DefectosBanco }>>('/opciones/cuentas-bancarias', { params: { empresa_id, todas_monedas: todasMonedas ? 1 : undefined } }),
  opcionesTarjetas: (empresa_id: number) => client.get<ApiResponse<TarjetaResumen[]>>('/opciones/tarjetas', { params: { empresa_id } }),
}

// ── Devoluciones ──────────────────────────────────────────────────────────
export const devolucionesApi = {
  ventas:      (params: Record<string, unknown>) => list<DevolucionVenta>('/devoluciones-venta', params),
  venta:       (id: number) => get<DevolucionVenta>(`/devoluciones-venta/${id}`),
  compras:     (params: Record<string, unknown>) => list<DevolucionCompra>('/devoluciones-compra', params),
  compra:      (id: number) => get<DevolucionCompra>(`/devoluciones-compra/${id}`),
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

// ── Bitácora ────────────────────────────────────────────────────────────────
// global = true: vista del super admin (/sa), incluye roles, usuarios y todas las empresas
export const bitacoraApi = {
  list:     (params: Record<string, unknown>, global = false) => list<Bitacora>(global ? '/sa/bitacora' : '/bitacora', params),
  opciones: (empresa_id: number | undefined, global = false) =>
    client.get<ApiResponse<{ usuarios: { id: number; nombre: string }[] }>>(global ? '/sa/bitacora/opciones' : '/bitacora/opciones', { params: { empresa_id } }),
}
