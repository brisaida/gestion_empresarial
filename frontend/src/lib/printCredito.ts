import type { AbonoVenta, EstadoCuenta, DevolucionVenta, DevolucionCompra } from '@/types'
import { coloresDocumento, formatoNumeroFactura, type PrintEmpresa } from './printVenta'
import { numeroALetras } from './numeroALetras'

/* Documentos de ventas al crédito: recibo de abono y estado de cuenta del cliente. */

const fecha = (f?: string | null) => {
  const m = f?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f ?? '')
}
const num = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const esc = (s?: string | null) =>
  (s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const METODO: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cheque: 'Cheque' }

function abrir(html: string) {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    alert('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.')
    return
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function encabezado(empresa: PrintEmpresa, logo: string | undefined, titulo: string, sub: string) {
  const { NAVY } = coloresDocumento(empresa)
  return `
  <div class="top">
    <div class="emp">
      ${logo ? `<img src="${logo}" alt="Logo">` : ''}
      <div class="razon">${esc(empresa.nombre_legal || empresa.nombre)}</div>
      ${empresa.rtn ? `<div><b>RTN:</b> ${esc(empresa.rtn)}</div>` : ''}
      ${empresa.direccion ? `<div>${esc(empresa.direccion)}</div>` : ''}
      ${[empresa.telefono, empresa.correo].filter(Boolean).map(esc).join(' · ')}
    </div>
    <div class="doc">
      <h1 style="color:${NAVY}">${titulo}</h1>
      <div class="sub">${sub}</div>
    </div>
  </div>`
}

function estilos(empresa: PrintEmpresa) {
  const { NAVY, BLUE } = coloresDocumento(empresa)
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #eef1f5; font-size: 12px; }
    .page { width: 210mm; min-height: 140mm; margin: 10mm auto; background: #fff; padding: 14mm; position: relative; }
    .top { display: flex; justify-content: space-between; gap: 10mm; border-bottom: 2px solid ${NAVY}; padding-bottom: 8px; }
    .emp { font-size: 10px; line-height: 1.4; color: #444; }
    .emp img { max-height: 22mm; max-width: 60mm; object-fit: contain; display: block; margin-bottom: 4px; }
    .emp .razon { font-size: 13px; font-weight: 800; color: #222; text-transform: uppercase; }
    .doc { text-align: right; }
    .doc h1 { font-size: 18px; letter-spacing: .5px; }
    .doc .sub { font-size: 12px; margin-top: 4px; color: #444; }
    .box { margin-top: 12px; border: 1px solid #ccc; border-radius: 6px; padding: 10px 12px; }
    .row { display: flex; gap: 8px; margin: 3px 0; }
    .row b { min-width: 34mm; display: inline-block; color: #555; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: ${NAVY}; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; padding: 6px; text-align: left; }
    td { border-bottom: 1px solid #e5e7eb; padding: 6px; font-size: 11px; }
    .r { text-align: right; } .c { text-align: center; }
    .venc { color: #b91c1c; font-weight: 700; }
    .monto { font-size: 22px; font-weight: 800; color: ${BLUE}; }
    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 12px; }
    .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 6px; text-align: center; }
    .kpi small { display: block; font-size: 9px; color: #666; text-transform: uppercase; }
    .kpi span { font-weight: 800; font-size: 12px; }
    .firma { margin-top: 26mm; display: flex; justify-content: space-around; }
    .firma div { width: 60mm; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 11px; }
    .anulado { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-20deg); font-size: 64px; font-weight: 900; color: rgba(220,38,38,.18); }
    .no-print { text-align: center; margin: 10px; }
    .no-print button { background: ${BLUE}; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { margin: 0; width: auto; min-height: 0; }
      .no-print { display: none; }
      @page { size: letter; margin: 8mm; }
    }`
}

const boton = `<div class="no-print"><button onclick="window.print()">🖨️ Guardar / Imprimir PDF</button></div>`

/** Recibo por uno o varios abonos registrados juntos (abono general reparte en varias facturas). */
export function printReciboAbono(abonos: AbonoVenta[], empresa: PrintEmpresa, logo?: string, saldoRestante?: number) {
  if (abonos.length === 0) return
  const a     = abonos[0]
  const total = abonos.reduce((s, x) => s + Number(x.monto), 0)
  const nro   = `REC-${String(a.id).padStart(6, '0')}`

  const filas = abonos.map(x => `
    <tr><td>${esc(formatoNumeroFactura(x.numero_factura))}</td><td class="r">L ${num(x.monto)}</td></tr>`).join('')

  abrir(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo ${nro}</title>
  <style>${estilos(empresa)}</style></head><body>${boton}
  <div class="page">
    ${a.anulado ? '<div class="anulado">ANULADO</div>' : ''}
    ${encabezado(empresa, logo, 'RECIBO DE PAGO', `No. <b>${nro}</b><br>Fecha: ${fecha(a.fecha)}`)}
    <div class="box">
      <div class="row"><b>Recibimos de:</b> ${esc(a.cliente ?? '')}</div>
      <div class="row"><b>La cantidad de:</b> <span class="monto">L ${num(total)}</span></div>
      <div class="row"><b></b> <i>${esc(numeroALetras(total))}</i></div>
      <div class="row"><b>Forma de pago:</b> ${METODO[a.metodo_pago] ?? a.metodo_pago}${a.referencia ? ` · Ref. ${esc(a.referencia)}` : ''}</div>
      ${a.observaciones ? `<div class="row"><b>Concepto:</b> ${esc(a.observaciones)}</div>` : ''}
    </div>
    <table><thead><tr><th>Abono a factura</th><th class="r">Monto</th></tr></thead><tbody>${filas}</tbody></table>
    ${saldoRestante != null ? `<p style="margin-top:10px" class="r">Saldo pendiente del cliente: <b>L ${num(saldoRestante)}</b></p>` : ''}
    <div class="firma"><div>Recibido por${a.usuario ? `<br>${esc(a.usuario)}` : ''}</div><div>Cliente</div></div>
  </div></body></html>`)
}

/** Estado de cuenta: facturas pendientes con antigüedad y últimos abonos. */
export function printEstadoCuenta(ec: EstadoCuenta, empresa: PrintEmpresa, logo?: string, hoy?: string) {
  const c = ec.cliente
  const r = ec.resumen
  const facturas = ec.facturas.map(f => `
    <tr>
      <td>${esc(formatoNumeroFactura(f.numero_factura))}</td>
      <td class="c">${fecha(f.fecha_venta)}</td>
      <td class="c ${f.estado_pago === 'vencida' ? 'venc' : ''}">${fecha(f.fecha_vencimiento)}</td>
      <td class="c ${f.estado_pago === 'vencida' ? 'venc' : ''}">${f.estado_pago === 'vencida' ? `${f.dias_vencida} días` : 'Al día'}</td>
      <td class="r">L ${num(f.total)}</td>
      <td class="r">L ${num(f.total_abonado ?? 0)}</td>
      <td class="r"><b>L ${num(f.saldo_pendiente ?? 0)}</b></td>
    </tr>`).join('') || '<tr><td colspan="7" class="c">El cliente no tiene facturas pendientes.</td></tr>'

  const abonos = ec.abonos.filter(a => !a.anulado).slice(0, 15).map(a => `
    <tr><td>${fecha(a.fecha)}</td><td>${esc(formatoNumeroFactura(a.numero_factura))}</td>
    <td>${METODO[a.metodo_pago] ?? a.metodo_pago}${a.referencia ? ` · ${esc(a.referencia)}` : ''}</td><td class="r">L ${num(a.monto)}</td></tr>`).join('')

  const kpi = (l: string, v: number) => `<div class="kpi"><small>${l}</small><span>L ${num(v)}</span></div>`

  abrir(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Estado de cuenta ${esc(c.nombre)}</title>
  <style>${estilos(empresa)}</style></head><body>${boton}
  <div class="page">
    ${encabezado(empresa, logo, 'ESTADO DE CUENTA', `Al ${fecha(hoy)}`)}
    <div class="box">
      <div class="row"><b>Cliente:</b> <span style="font-weight:700">${esc(c.nombre)}</span></div>
      ${c.rtn ? `<div class="row"><b>RTN:</b> ${esc(c.rtn)}</div>` : ''}
      ${c.telefono ? `<div class="row"><b>Teléfono:</b> ${esc(c.telefono)}</div>` : ''}
      <div class="row"><b>Plazo de crédito:</b> ${c.dias_credito} días${c.limite_credito != null ? ` · Límite L ${num(c.limite_credito)}` : ''}</div>
    </div>
    <div class="kpis">
      ${kpi('Saldo total', r.saldo)}${kpi('Al día', r.al_dia)}${kpi('1–30 días', r.d1_30)}
      ${kpi('31–60 días', r.d31_60)}${kpi('61–90 días', r.d61_90)}${kpi('Más de 90', r.d90_mas)}
    </div>
    <table>
      <thead><tr><th>Factura</th><th class="c">Fecha</th><th class="c">Vence</th><th class="c">Atraso</th>
      <th class="r">Total</th><th class="r">Abonado</th><th class="r">Saldo</th></tr></thead>
      <tbody>${facturas}</tbody>
    </table>
    ${abonos ? `<h3 style="margin-top:14px;font-size:12px">Últimos abonos</h3>
    <table><thead><tr><th>Fecha</th><th>Factura</th><th>Forma de pago</th><th class="r">Monto</th></tr></thead><tbody>${abonos}</tbody></table>` : ''}
  </div></body></html>`)
}

const REEMBOLSO: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cambio: 'Cambio por otro producto / saldo a favor',
}

/** Comprobante interno de devolución: de un cliente (DEV-) o a un proveedor (DPV-). */
export function printDevolucion(d: DevolucionVenta | DevolucionCompra, tipo: 'cliente' | 'proveedor', empresa: PrintEmpresa, logo?: string) {
  const esCliente = tipo === 'cliente'
  const parte = esCliente ? (d as DevolucionVenta).cliente : (d as DevolucionCompra).proveedor
  const doc   = esCliente ? formatoNumeroFactura(d.numero_factura) : (d.numero_factura ?? '')

  const filas = (d.detalles ?? []).map(x => `
    <tr>
      <td>${x.codigo ? `<span style="color:#666">${esc(x.codigo)}</span> ` : ''}${esc(x.nombre ?? 'Producto')}${esCliente && x.regresa_a_stock === false ? ' <i style="color:#888">(no regresa a inventario)</i>' : ''}</td>
      <td class="c">${Number(x.cantidad).toString()}</td>
      <td class="r">L ${num(x.precio)}</td>
      <td class="r">L ${num(x.subtotal)}</td>
    </tr>`).join('')

  const liquidacion = [
    d.aplicado_a_saldo > 0 ? `<div class="row"><b>${esCliente ? 'Descontado del saldo:' : 'Descontado de lo que se debe:'}</b> L ${num(d.aplicado_a_saldo)}</div>` : '',
    d.reembolsado > 0 ? `<div class="row"><b>${esCliente ? 'Reembolso al cliente:' : 'Reembolso del proveedor:'}</b> L ${num(d.reembolsado)} · ${REEMBOLSO[d.reembolso_metodo ?? ''] ?? ''}</div>` : '',
  ].join('')

  abrir(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Devolución ${esc(d.numero)}</title>
  <style>${estilos(empresa)}</style></head><body>${boton}
  <div class="page">
    ${encabezado(empresa, logo, esCliente ? 'DEVOLUCIÓN DE CLIENTE' : 'DEVOLUCIÓN A PROVEEDOR', `No. <b>${esc(d.numero)}</b><br>Fecha: ${fecha(d.fecha)}`)}
    <div class="box">
      <div class="row"><b>${esCliente ? 'Cliente:' : 'Proveedor:'}</b> <span style="font-weight:700">${esc(parte?.nombre ?? (esCliente ? 'Consumidor final' : ''))}</span>${parte?.rtn ? ` · RTN ${esc(parte.rtn)}` : ''}</div>
      <div class="row"><b>${esCliente ? 'Factura:' : 'Factura del proveedor:'}</b> ${esc(doc)}</div>
      <div class="row"><b>Motivo:</b> ${esc(d.motivo)}</div>
      ${d.bodega ? `<div class="row"><b>Bodega:</b> ${esc(d.bodega)}</div>` : ''}
    </div>
    <table>
      <thead><tr><th>Producto</th><th class="c">Cantidad</th><th class="r">${esCliente ? 'Precio' : 'Costo'}</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <table style="width:auto;margin-left:auto;margin-top:8px">
      <tr><td>Subtotal (con descuento)</td><td class="r">L ${num(d.subtotal)}</td></tr>
      <tr><td>ISV</td><td class="r">L ${num(d.impuesto)}</td></tr>
      <tr><td><b>Total devuelto</b></td><td class="r"><b>L ${num(d.total)}</b></td></tr>
    </table>
    <div class="box">${liquidacion || '<div class="row">Sin movimiento de dinero.</div>'}</div>
    <p style="margin-top:8px;font-size:10px;color:#666">Documento interno. No sustituye una nota de crédito fiscal.</p>
    <div class="firma"><div>Entregado por${d.usuario ? `<br>${esc(d.usuario)}` : ''}</div><div>${esCliente ? 'Cliente' : 'Proveedor'}</div></div>
  </div></body></html>`)
}
