import type { Venta } from '@/types'
import { numeroALetras } from './numeroALetras'

export interface PrintEmpresa {
  nombre: string
  nombre_legal?: string
  rtn?: string
  telefono?: string
  correo?: string
  direccion?: string
  isv_rate?: number
  color_primario?: string | null
  color_secundario?: string | null
}

/** Colores de la empresa para los formatos de descarga (NAVY = secundario, BLUE = primario) */
export function coloresDocumento(e: PrintEmpresa) {
  return {
    NAVY: e.color_secundario || '#072B5A',
    BLUE: e.color_primario   || '#0E78D8',
  }
}

const esc = (t: string | null | undefined) =>
  (t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Facturas antiguas "FAC-0011" se muestran rellenadas al formato SAR: 000-001-01-00000011 */
export function formatoNumeroFactura(numero?: string | null): string {
  const m = numero?.match(/^FAC-(\d+)$/)
  return m ? `000-001-01-${m[1].padStart(8, '0')}` : (numero ?? '')
}

const num = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** YYYY-MM-DD → DD/MM/YYYY */
const fecha = (f?: string | null) => {
  const m = f?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f ?? '')
}

/** Factura en el formato modelo del SAR (Honduras), tamaño carta */
export function printVenta(v: Venta, empresa: PrintEmpresa, logoSrc?: string): void {
  const detalles = v.detalles ?? []
  const isvRate  = Number(empresa.isv_rate ?? 15)

  // El descuento global se reparte proporcionalmente entre las líneas
  const factor = v.subtotal > 0 ? 1 - v.descuento / v.subtotal : 1

  // Importes exento / gravado por tasa
  let exento = 0, exonerado = 0, totalDesc = 0, totalNeto = 0
  const gravado = new Map<number, number>()
  const lineas = detalles.map(d => {
    const desc = Number(d.subtotal) * (1 - factor)
    const neto = Number(d.subtotal) - desc
    const tasa = d.tasa_isv ?? isvRate
    // En una venta exonerada lo que pagaría ISV pasa a "importe exonerado"
    if (tasa > 0 && v.exonerado) exonerado += neto
    else if (v.impuesto > 0 && tasa > 0) gravado.set(tasa, (gravado.get(tasa) ?? 0) + neto)
    else exento += neto
    totalDesc += desc; totalNeto += neto
    const cant = Number(d.cantidad) % 1 === 0 ? Number(d.cantidad) : num(d.cantidad)
    return `
      <tr>
        <td class="c">${cant}${d.unidad ? ` <span class="und">${esc(d.unidad)}</span>` : ''}</td>
        <td>${d.codigo ? `<span class="cod">${esc(d.codigo)}</span> ` : ''}${esc(d.producto ?? d.receta ?? 'Producto')}</td>
        <td class="r">${num(d.precio_unitario)}</td>
        <td class="r">${num(desc)}</td>
        <td class="r">${num(neto)}</td>
      </tr>`
  }).join('')

  // Siempre 15% y 18% como en el modelo del SAR, más cualquier otra tasa usada
  const tasas = [...new Set([15, 18, ...gravado.keys()])].sort((a, b) => a - b)
  const tasasConBase = [...gravado.keys()]
  const pct = (t: number) => Number.isInteger(t) ? t : t.toFixed(2)
  const isvDe = (t: number) => {
    const base = gravado.get(t) ?? 0
    if (!base) return 0
    return tasasConBase.length === 1 ? v.impuesto : base * t / 100
  }
  const fila = (label: string, valor: number, cls = '') =>
    `<tr class="${cls}"><th>${label}</th><td class="l">L.</td><td class="v">${num(valor)}</td></tr>`

  // Alto vacío para que el cuadro de productos llene la página como en el modelo
  const relleno = Math.max(6, 100 - detalles.length * 5.6)

  const envio = Number(v.costo_envio ?? 0)
  const filasTotales = [
    fila('IMPORTE EXONERADO', exonerado),
    fila('IMPORTE EXENTO', exento),
    ...tasas.map(t => fila(`IMPORTE GRAVADO ${pct(t)}%`, gravado.get(t) ?? 0)),
    ...tasas.map(t => fila(`I.S.V. ${pct(t)}%`, isvDe(t))),
    envio > 0 ? fila('ENVÍO', envio) : '',
    fila('TOTAL A PAGAR', v.total, 'total'),
  ].join('')

  // Los datos del CAI salen de la venta (copia al emitirla), no de la configuración actual
  const rango = v.cai_rango_desde || v.cai_rango_hasta
    ? `RANGO AUTORIZADO DEL ${esc(v.cai_rango_desde ?? '')} AL ${esc(v.cai_rango_hasta ?? '')}`
    : ''

  const datosEmpresa = [
    `<div class="razon">${esc(empresa.nombre_legal || empresa.nombre)}</div>`,
    empresa.rtn          ? `<div class="b">R.T.N.: ${esc(empresa.rtn)}</div>` : '',
    empresa.direccion    ? `<div>${esc(empresa.direccion)}</div>` : '',
    empresa.telefono     ? `<div>TEL.: ${esc(empresa.telefono)}</div>` : '',
    empresa.correo       ? `<div>Correo electrónico: ${esc(empresa.correo)}</div>` : '',
    v.cai                ? `<div>C.A.I.: ${esc(v.cai)}</div>` : '',
    rango                ? `<div class="b">${rango}</div>` : '',
    v.cai_fecha_limite   ? `<div>Fecha Límite de Emisión: ${fecha(v.cai_fecha_limite)}</div>` : '',
  ].filter(Boolean).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(formatoNumeroFactura(v.numero_factura) || 'Factura')} — Factura</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; font-size: 11px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: letter; margin: 10mm; }
      .no-print { display: none !important; }
      .page { padding: 0; }
    }
    .page { width: 196mm; min-height: 254mm; margin: 0 auto; padding: 8mm 0; display: flex; flex-direction: column; position: relative; }
    table { border-collapse: collapse; }

    .top { display: flex; justify-content: space-between; gap: 10mm; }
    .emp { font-size: 10px; line-height: 1.35; color: #444; }
    .emp img { max-height: 26mm; max-width: 70mm; object-fit: contain; display: block; margin-bottom: 6px; }
    .emp .razon { font-size: 13px; font-weight: 800; color: #222; text-transform: uppercase; }
    .emp .b { font-weight: 700; color: #222; }
    .fac { text-align: right; display: flex; flex-direction: column; justify-content: space-between; min-width: 72mm; }
    .fac h1 { font-size: 18px; letter-spacing: 1px; text-align: right; }
    .fac .no { font-size: 22px; white-space: nowrap; }
    .fac .no small { font-size: 11px; font-weight: 700; }
    .fac .fecha { font-size: 11px; margin-top: 14px; text-align: left; display: flex; gap: 6px; align-items: flex-end; }
    .fac .fecha span { flex: 1; border-bottom: 1px solid #999; padding: 0 4px 1px; font-size: 12px; }

    .cliente { margin-top: 12px; display: flex; align-items: stretch; border: 1px solid #999; border-radius: 6px; overflow: hidden; }
    .cliente .tag { background: #333; color: #fff; font-weight: 700; padding: 9px 12px; font-size: 11px; }
    .cliente .nom { flex: 1; padding: 9px 12px; font-size: 12px; }
    .cliente .rtn { padding: 9px 14px; font-size: 12px; white-space: nowrap; }
    .cliente .rtn b { font-size: 10px; margin-right: 8px; }

    .det { width: 100%; margin-top: 12px; }
    .det table { width: 100%; }
    .det thead th { background: #333; color: #fff; font-size: 11px; padding: 7px 6px; border-left: 1px solid #fff; }
    .det thead th:first-child { border-left: none; border-top-left-radius: 6px; }
    .det thead th:last-child { border-top-right-radius: 6px; }
    .det thead th.small { font-size: 8.5px; }
    .det tbody td { border-left: 1px solid #999; padding: 4px 6px; font-size: 11px; vertical-align: top; }
    .det tbody td:last-child { border-right: 1px solid #999; }
    .det tbody tr.relleno td { border-bottom: 1px solid #999; }
    .det .c { text-align: center; } .det .r { text-align: right; }
    .det .und { font-size: 9px; color: #555; }
    .det .cod { font-size: 9px; color: #555; font-family: monospace; }
    .det tfoot td { padding: 7px 6px; font-size: 12px; }
    .det tfoot td.t { border: 1px solid #999; border-top: none; text-align: right; font-weight: 700; }
    .det tfoot td.lbl { text-align: center; font-size: 14px; font-weight: 700; border-bottom-left-radius: 6px; }
    .det tfoot td.fin { border-bottom-right-radius: 6px; }

    .bottom { display: flex; gap: 10mm; margin-top: auto; padding-top: 12px; align-items: flex-end; }
    .izq { flex: 1.15; }
    .letras { background: #D1D3D4; border: 1px solid #aaa; border-radius: 12px; padding: 4px 12px 8px; min-height: 12mm; }
    .letras small { font-size: 8px; font-weight: 700; display: block; margin-bottom: 3px; }
    .letras div { font-size: 11px; font-weight: 700; }
    .exija { font-weight: 700; font-size: 12px; margin: 10px 0 5px 14px; letter-spacing: .3px; }
    .reg { width: 100%; font-size: 9.5px; }
    .reg td { border: 1px solid #aaa; padding: 3px 6px; }
    .reg td:first-child { font-weight: 700; width: 62%; }
    .reg td:last-child { background: #D1D3D4; }

    .tot { flex: 1; }
    .tot table { width: 100%; }
    .tot th { text-align: right; font-size: 10px; font-weight: 700; padding: 0 4px; white-space: nowrap; }
    .tot td.l { width: 14px; font-size: 10px; font-weight: 700; }
    .tot td.v { background: #D1D3D4; border: 1px solid #aaa; text-align: right; padding: 3px 8px; font-size: 11px; width: 40%; }
    .tot tr.total th, .tot tr.total td.l { color: #C0392B; font-size: 12px; padding-top: 4px; }
    .tot tr.total td.v { background: #fff; font-weight: 700; font-size: 13px; }

    .pie { margin-top: 14px; font-size: 11px; font-weight: 700; color: #444; letter-spacing: .3px; }
    .pie span { margin-right: 28px; }

    .anulada { position: absolute; top: 42%; left: 0; right: 0; text-align: center; font-size: 90px; font-weight: 800;
      color: rgba(220, 38, 38, .18); transform: rotate(-25deg); pointer-events: none; }
  </style>
</head>
<body>

<div class="no-print" style="text-align:right;max-width:196mm;margin:16px auto 0">
  <button onclick="window.print()" style="background:#333;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">
    🖨️ Guardar / Imprimir PDF
  </button>
</div>

<div class="page">
  ${v.estado === 'cancelada' ? '<div class="anulada">ANULADA</div>' : ''}

  <div class="top">
    <div class="emp">
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ''}
      ${datosEmpresa}
    </div>
    <div class="fac">
      <div>
        <h1>FACTURA</h1>
        <div class="no"><small>No.</small> ${esc(formatoNumeroFactura(v.numero_factura))}</div>
      </div>
      <div class="fecha">FECHA: <span>${fecha(v.fecha_venta)}</span></div>
    </div>
  </div>

  <div class="cliente">
    <div class="tag">CLIENTE:</div>
    <div class="nom">${esc(v.cliente?.nombre ?? 'CONSUMIDOR FINAL')}</div>
    <div class="rtn"><b>R.T.N.:</b>${esc(v.cliente?.rtn ?? '')}</div>
  </div>

  <div class="det">
    <table>
      <thead>
        <tr>
          <th style="width:12%">CANTIDAD</th>
          <th style="letter-spacing:6px">DESCRIPCION</th>
          <th style="width:15%">PRECIO<br>UNITARIO</th>
          <th class="small" style="width:16%">DESCUENTOS Y<br>REBAJAS OTORGADOS</th>
          <th style="width:16%">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${lineas}
        <tr class="relleno" style="height:${relleno}mm"><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2"></td>
          <td class="t lbl">TOTAL</td>
          <td class="t">${num(totalDesc)}</td>
          <td class="t fin">${num(totalNeto)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="bottom">
    <div class="izq">
      <div class="letras">
        <small>VALOR EN LETRAS:</small>
        <div>${numeroALetras(v.total)}</div>
      </div>
      <div class="exija">LA FACTURA ES BENEFICIO DE TODOS "EXÍJALA"</div>
      <table class="reg">
        <tr><td>N° Correlativo de orden de compra exenta</td><td>${esc(v.orden_compra_exenta)}</td></tr>
        <tr><td>N° Correlativo de constancia de registro exonerado</td><td>${esc(v.constancia_exonerado)}</td></tr>
        <tr><td>N° identificativo del registro de la SAG</td><td>${esc(v.registro_sag)}</td></tr>
      </table>
    </div>
    <div class="tot">
      <table>${filasTotales}</table>
    </div>
  </div>

  <div class="pie"><span>ORIGINAL: CLIENTE</span><span>COPIA: EMISOR</span></div>
</div>
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
