export interface ModuloDefinicion {
  key: string
  label: string
  descripcion: string
}

export const MODULOS: ModuloDefinicion[] = [
  { key: 'dashboard',     label: 'Dashboard',           descripcion: 'Ver resumen general e indicadores' },
  { key: 'ventas',        label: 'Ventas',              descripcion: 'Crear y consultar ventas/facturas' },
  { key: 'cotizaciones',  label: 'Cotizaciones',        descripcion: 'Crear y gestionar cotizaciones' },
  { key: 'compras',       label: 'Compras',             descripcion: 'Registrar y aprobar compras a proveedores' },
  { key: 'traslados',     label: 'Traslados',           descripcion: 'Mover stock entre bodegas' },
  { key: 'inventario',    label: 'Inventario & Stock',  descripcion: 'Ver existencias, movimientos y alertas' },
  { key: 'catalogos',     label: 'Catálogos',           descripcion: 'Gestionar productos, clientes, proveedores, bodegas…' },
  { key: 'configuracion', label: 'Configuración',       descripcion: 'Datos fiscales, logo e ISV de la empresa' },
  { key: 'ver_costos',    label: 'Ver precios de costo', descripcion: 'Mostrar precio de costo en productos y compras' },
]

export const TODOS_LOS_MODULOS = MODULOS.map(m => m.key)
