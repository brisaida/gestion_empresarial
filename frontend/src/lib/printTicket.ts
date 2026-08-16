import type { Venta } from '@/types'
import type { PrintEmpresa } from './printVenta'

const fmt = (n: number) =>
  'L ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const line = (char = '-', len = 32) => char.repeat(len)

export function printTicket(v: Venta, empresa: PrintEmpresa): void {
  const detalles = v.detalles ?? []
  const isvPct   = empresa.isv_rate ?? 15

  const filas = detalles.map(d => {
    const nombre = typeof d.producto === 'string' ? d.producto : (d.producto?.nombre ?? 'Producto')
    const cant   = Number(d.cantidad).toFixed(2)
    const price  = fmt(d.precio_unitario)
    const sub    = fmt(d.subtotal)
    return `
      <div class="item-name">${nombre}</div>
      <div class="item-row">
        <span>${cant} × ${price}</span>
        <span>${sub}</span>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${v.numero_factura ?? 'Ticket'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: 80mm;
      margin: 0 auto;
      padding: 4mm 3mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 80mm auto; margin: 0; }
      .no-print { display: none !important; }
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .sep    { letter-spacing: -1px; color: #555; margin: 4px 0; }
    .item-name { margin-top: 5px; font-weight: bold; }
    .item-row  { display: flex; justify-content: space-between; color: #333; padding-left: 4px; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 4px; }
    .sub-row   { display: flex; justify-content: space-between; color: #555; font-size: 11px; }
    .empresa   { font-size: 13px; font-weight: bold; }
    .fiscal    { font-size: 10px; color: #333; }
    .num-fac   { font-size: 13px; font-weight: bold; letter-spacing: 1px; }
    .no-print  { text-align: center; margin-bottom: 8px; }
    .no-print button {
      background: #0E78D8; color: #fff; border: none;
      padding: 6px 18px; border-radius: 6px; font-size: 12px; cursor: pointer;
    }
    .gracias { font-size: 11px; color: #555; margin-top: 6px; }
  </style>
</head>
<body>

  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
  </div>

  <!-- ENCABEZADO -->
  <div class="center">
    <div class="empresa">${empresa.nombre}</div>
    ${empresa.nombre_legal && empresa.nombre_legal !== empresa.nombre
      ? `<div class="fiscal">${empresa.nombre_legal}</div>`
      : ''}
    ${empresa.rtn       ? `<div class="fiscal">RTN: ${empresa.rtn}</div>`       : ''}
    ${empresa.telefono  ? `<div class="fiscal">Tel: ${empresa.telefono}</div>`  : ''}
    ${empresa.correo    ? `<div class="fiscal">${empresa.correo}</div>`          : ''}
    ${empresa.direccion ? `<div class="fiscal">${empresa.direccion}</div>`       : ''}
  </div>

  <div class="sep center">${line()}</div>

  <!-- N° FACTURA Y FECHA -->
  <div class="center num-fac">${v.numero_factura ?? '—'}</div>
  <div class="center fiscal">Fecha: ${v.fecha_venta}</div>
  ${v.cliente?.nombre
    ? `<div class="center fiscal" style="margin-top:2px">Cliente: ${v.cliente.nombre}</div>`
    : ''}

  <div class="sep center">${line()}</div>

  <!-- PRODUCTOS -->
  <div>${filas || '<div class="center" style="color:#aaa">Sin productos</div>'}</div>

  <div class="sep center">${line()}</div>

  <!-- TOTALES -->
  <div class="sub-row"><span>Subtotal</span><span>${fmt(v.subtotal)}</span></div>
  ${v.descuento > 0
    ? `<div class="sub-row"><span>Descuento</span><span>- ${fmt(v.descuento)}</span></div>`
    : ''}
  ${v.impuesto > 0
    ? `<div class="sub-row"><span>ISV (${isvPct}%)</span><span>${fmt(v.impuesto)}</span></div>`
    : ''}
  <div class="sep center">${line('=')}</div>
  <div class="total-row"><span>TOTAL</span><span>${fmt(v.total)}</span></div>
  <div class="sep center">${line('=')}</div>

  <!-- FOOTER -->
  <div class="center gracias" style="margin-top:10px">
    Gracias por su compra
  </div>
  <div class="center fiscal" style="margin-top:4px; margin-bottom:6mm">${empresa.nombre}</div>

</body>
</html>`

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    alert('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.')
    return
  }
  setTimeout(() => URL.revokeObjectURL(url), 15_000)
}
