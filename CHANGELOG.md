# Cambios

Lo que cambió en el sistema, de lo más reciente a lo más antiguo.
Cada versión se publica en producción al subirla a `main` (Railway despliega solo).

## Sin publicar

- **Bitácora de auditoría** (Sistema → Bitácora): registra quién crea, edita, cancela, anula o elimina productos, clientes, proveedores, ventas, compras, cotizaciones, requisiciones, traslados, ajustes de inventario, abonos, pagos, tarjetas, bancos y configuración, con los valores de antes y después. También los inicios de sesión (y los intentos fallidos). Se puede filtrar por usuario, módulo, acción y fechas, y ver el historial completo de un registro.
- El super admin tiene su propia bitácora con todas las empresas, roles y usuarios.

## Noviembre 2026

**27 nov**
- Corregido: al convertir una cotización a venta **al crédito** decía que no tenía cliente aunque sí lo tuviera.
- **Bancos** (Finanzas → Bancos): cuentas en lempiras y dólares, saldo inicial, comisión POS, movimientos automáticos desde ventas, abonos, compras y pagos, depósitos de caja, transferencias entre cuentas (con tipo de cambio) y conciliación.
- Nuevo permiso **Finanzas**: Cuentas por cobrar, Cuentas por pagar, Tarjetas de crédito y Bancos pasan a un menú propio.

**25 nov**
- **Tarjetas de crédito de la empresa**: varias tarjetas (banco + últimos 4 dígitos), cargos automáticos desde requisiciones y compras, pagos al banco y saldo adeudado.
- Reportes: el margen ya no incluye el ISV y descuenta las devoluciones.

**20 nov**
- **Devoluciones** de clientes (en Ventas) y a proveedores (en Compras), con comprobante interno.
- Costo de envío en compras (se suma al total).
- Al cancelar una venta o compra se pide el motivo y queda quién la canceló.
- **Compras al crédito** con Cuentas por pagar: saldo por proveedor, vencimientos y pagos.

**19 nov**
- **Ventas al crédito** con Cuentas por cobrar: días de crédito por defecto (empresa o cliente), límite de crédito, abonos con recibo y estado de cuenta.
- Cancelar una venta devuelve el stock.
- El código de un producto eliminado se puede volver a usar.

**16 nov**
- Ficha del producto con foto grande desde Stock.
- Corregido el ISV incluido al crear producto desde compras.

## Octubre 2026

- Corregir productos pendientes y unir duplicados desde el dashboard.
- Código obligatorio y revisión de duplicados al crear producto desde compras.
- Los productos inactivos se ocultan en selectores, existencias, dashboard y reportes.
- Eliminar un producto lo desactiva y descarta su stock con un ajuste de inventario.
- Resumen de confirmación antes de guardar un producto.
- Factura en formato SAR (CAI, numeración correlativa, ventas exoneradas); cotización y requisición con el mismo formato.

## Septiembre 2026

- Requisiciones a proveedores con firma y sello autorizados por PIN.
- Colores de la empresa en la interfaz, documentos y exportaciones a Excel.
- Artículos libres en cotizaciones.
- Cierre de sesión por inactividad, configurable.
- Traslados de stock y filtros en el historial de movimientos.
- Costo de envío en ventas.

## Agosto 2026

- Marcas, movimientos rediseñados, colores por empresa, precio con ISV incluido.
- Ticket de 80 mm y stock inicial al crear producto.

## Julio 2026

- Restaurante completo: mesas, rondas, pantalla de cocina y cobro por mesa.
- Método de pago, cierre de caja y bodega predeterminada.
- PWA, escáner de código de barras e importación de productos y categorías desde Excel.
- Categorías múltiples por producto.

## Mayo – Junio 2026

- Versión inicial: productos, inventario, compras, ventas, cotizaciones, traslados, reportes, dashboard.
- Multiempresa con roles y permisos por módulo; panel de super admin.
- Costeo de inventario por promedio ponderado.
- Despliegue en Railway.
