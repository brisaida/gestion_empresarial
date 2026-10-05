import type { Requisicion, DatosFirma } from '@/types'
import { type PrintEmpresa } from './printVenta'
import { numeroALetras } from './numeroALetras'
import { bloqueFirma } from './firmaDocumento'

// Descripciones, códigos y nombres se escriben a mano: escaparlos
const esc = (t?: string | null) =>
  (t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const num = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** YYYY-MM-DD → DD/MM/YYYY */
const fecha = (f?: string | null) => {
  const m = f?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f ?? '')
}

/** Requisición a proveedor con el mismo formato que la factura y la cotización */
export async function printRequisicion(r: Requisicion, empresa: PrintEmpresa, logoSrc?: string, firma?: DatosFirma | null): Promise<void> {
  const detalles  = r.detalles ?? []
  const condicion = r.condicion === 'credito' ? 'CRÉDITO' : r.condicion === 'contado' ? 'CONTADO' : '—'

  /* ── Filas de artículos ─────────────────────────────────── */
  const filas = detalles.map(d => {
    const cant = Number(d.cantidad) % 1 === 0 ? Number(d.cantidad) : num(d.cantidad)
    return `
      <tr>
        <td class="c">${cant}</td>
        <td>${d.codigo ? `<span class="cod">${esc(d.codigo)}</span> ` : ''}${esc(d.descripcion)}</td>
        <td class="r">${num(d.precio_unitario)}</td>
        <td class="r">${num(d.subtotal)}</td>
      </tr>`
  }).join('')

  // Alto vacío para que el cuadro de artículos llene la página (aprox. en mm)
  const relleno = Math.max(6, 112 - detalles.length * 5.6 - (r.observaciones ? 14 : 0))

  /* ── Empresa ────────────────────────────────────────────── */
  const razon = empresa.nombre_legal || empresa.nombre
  const datosEmpresa = [
    `<div class="razon">${esc(razon)}</div>`,
    empresa.rtn       ? `<div class="b">R.T.N.: ${esc(empresa.rtn)}</div>` : '',
    empresa.direccion ? `<div>${esc(empresa.direccion)}</div>` : '',
    empresa.telefono  ? `<div>TEL.: ${esc(empresa.telefono)}</div>` : '',
    empresa.correo    ? `<div>Correo electrónico: ${esc(empresa.correo)}</div>` : '',
  ].filter(Boolean).join('')

  /* ── Proveedor ──────────────────────────────────────────── */
  const prov = r.proveedor
  const provExtra = [prov?.direccion, prov?.telefono ? `Tel.: ${prov.telefono}` : '', prov?.correo]
    .filter(Boolean).map(t => esc(t)).join(' · ')

  /* ── Totales ────────────────────────────────────────────── */
  const fila = (label: string, valor: number, cls = '') =>
    `<tr class="${cls}"><th>${label}</th><td class="l">L.</td><td class="v">${num(valor)}</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(r.numero_requisicion)} — Requisición</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; font-size: 11px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: letter; margin: 10mm; }
      .no-print { display: none !important; }
      .page { padding: 0; }
    }
    .page { width: 196mm; min-height: 254mm; margin: 0 auto; padding: 8mm 0; display: flex; flex-direction: column; }
    table { border-collapse: collapse; }

    .top { display: flex; justify-content: space-between; gap: 10mm; }
    .emp { font-size: 10px; line-height: 1.35; color: #444; }
    .emp img { max-height: 26mm; max-width: 70mm; object-fit: contain; display: block; margin-bottom: 6px; }
    .emp .razon { font-size: 13px; font-weight: 800; color: #222; text-transform: uppercase; }
    .emp .b { font-weight: 700; color: #222; }
    .doc { text-align: right; display: flex; flex-direction: column; justify-content: space-between; min-width: 74mm; }
    .doc h1 { font-size: 18px; letter-spacing: 1px; }
    .doc .no { font-size: 22px; white-space: nowrap; }
    .doc .no small { font-size: 11px; font-weight: 700; }
    .doc .linea { font-size: 11px; margin-top: 6px; text-align: left; display: flex; gap: 6px; align-items: flex-end; }
    .doc .linea b { white-space: nowrap; font-weight: 400; }
    .doc .linea span { flex: 1; border-bottom: 1px solid #999; padding: 0 4px 1px; font-size: 12px; }

    .barra { margin-top: 12px; display: flex; align-items: stretch; border: 1px solid #999; border-radius: 6px; overflow: hidden; }
    .barra .tag { background: #333; color: #fff; font-weight: 700; padding: 9px 12px; font-size: 11px; }
    .barra .nom { flex: 1; padding: 9px 12px; font-size: 12px; }
    .barra .rtn { padding: 9px 14px; font-size: 12px; white-space: nowrap; }
    .barra .rtn b { font-size: 10px; margin-right: 8px; }
    .extra { font-size: 10px; color: #555; margin: 4px 2px 0; }
    .facturar { font-size: 11px; margin: 6px 2px 0; }

    .obs { margin-top: 10px; border: 1px solid #aaa; border-radius: 8px; padding: 6px 12px; }
    .obs small { font-size: 8px; font-weight: 700; display: block; margin-bottom: 2px; }
    .obs p { font-size: 11px; line-height: 1.45; }

    .det { width: 100%; margin-top: 12px; }
    .det table { width: 100%; }
    .det thead th { background: #333; color: #fff; font-size: 11px; padding: 7px 6px; border-left: 1px solid #fff; }
    .det thead th:first-child { border-left: none; border-top-left-radius: 6px; }
    .det thead th:last-child { border-top-right-radius: 6px; }
    .det tbody td { border-left: 1px solid #999; padding: 4px 6px; font-size: 11px; vertical-align: top; }
    .det tbody td:last-child { border-right: 1px solid #999; }
    .det tbody tr.relleno td { border-bottom: 1px solid #999; }
    .det .c { text-align: center; } .det .r { text-align: right; }
    .det .cod { font-size: 9px; color: #555; font-family: monospace; }

    .bottom { display: flex; gap: 10mm; margin-top: auto; padding-top: 12px; align-items: flex-start; }
    .izq { flex: 1.15; }
    .letras { background: #D1D3D4; border: 1px solid #aaa; border-radius: 12px; padding: 4px 12px 8px; min-height: 12mm; }
    .letras small { font-size: 8px; font-weight: 700; display: block; margin-bottom: 3px; }
    .letras div { font-size: 11px; font-weight: 700; }

    .tot { flex: 1; }
    .tot table { width: 100%; }
    .tot th { text-align: right; font-size: 10px; font-weight: 700; padding: 0 4px; white-space: nowrap; }
    .tot td.l { width: 14px; font-size: 10px; font-weight: 700; }
    .tot td.v { background: #D1D3D4; border: 1px solid #aaa; text-align: right; padding: 3px 8px; font-size: 11px; width: 40%; }
    .tot tr.total th, .tot tr.total td.l { color: #C0392B; font-size: 12px; padding-top: 4px; }
    .tot tr.total td.v { background: #fff; font-weight: 700; font-size: 13px; }

    .firmas { display: flex; gap: 20mm; margin-top: 14px; padding: 0 10mm; font-size: 10.5px; text-align: center; }
    .firmas > div { flex: 1; }
    .firmas .linea-firma { border-top: 1px solid #999; padding-top: 6px; color: #555; }
  </style>
</head>
<body>

<div class="no-print" style="text-align:right;max-width:196mm;margin:16px auto 0">
  <button onclick="window.print()" style="background:#333;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">
    🖨️ Guardar / Imprimir PDF
  </button>
</div>

<div class="page">
  <div class="top">
    <div class="emp">
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ''}
      ${datosEmpresa}
    </div>
    <div class="doc">
      <div>
        <h1>REQUISICIÓN</h1>
        <div class="no"><small>No.</small> ${esc(r.numero_requisicion)}</div>
      </div>
      <div>
        <div class="linea"><b>FECHA DE ENVÍO:</b> <span>${fecha(r.fecha_requisicion)}</span></div>
        <div class="linea"><b>CONDICIÓN:</b> <span>${condicion}</span></div>
        <div class="linea"><b>ELABORADO POR:</b> <span>${esc(r.realizado_por?.toUpperCase()) || '—'}</span></div>
      </div>
    </div>
  </div>

  <div class="barra">
    <div class="tag">PROVEEDOR:</div>
    <div class="nom">${esc(prov?.nombre) || '—'}</div>
    <div class="rtn"><b>R.T.N.:</b>${esc(prov?.rtn)}</div>
  </div>
  ${provExtra ? `<div class="extra">${provExtra}</div>` : ''}
  <div class="facturar"><b>Facturar a:</b> ${esc(razon.toUpperCase())}${empresa.rtn ? ` &nbsp;·&nbsp; <b>R.T.N.:</b> ${esc(empresa.rtn)}` : ''}</div>

  ${r.observaciones ? `
  <div class="obs">
    <small>OBSERVACIONES:</small>
    <p>${esc(r.observaciones)}</p>
  </div>` : ''}

  <div class="det">
    <table>
      <thead>
        <tr>
          <th style="width:11%">CANTIDAD</th>
          <th style="letter-spacing:6px">DESCRIPCION</th>
          <th style="width:15%">PRECIO<br>UNITARIO</th>
          <th style="width:16%">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        <tr class="relleno" style="height:${relleno}mm"><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>

  <div class="bottom">
    <div class="izq">
      <div class="letras">
        <small>VALOR EN LETRAS:</small>
        <div>${numeroALetras(r.total)}</div>
      </div>
    </div>
    <div class="tot">
      <table>
        ${fila('SUB TOTAL', r.subtotal)}
        ${fila('I.S.V.', r.impuesto)}
        ${fila('TOTAL', r.total, 'total')}
      </table>
    </div>
  </div>

  <div class="firmas">
    <div>
      <!-- Mismo alto que el área de firma/sello de la derecha para que las líneas queden parejas -->
      <div style="height:${firma?.firma || firma?.sello ? 90 : 70}px"></div>
      <div class="linea-firma">ELABORADO POR</div>
      <div style="font-weight:700;color:#333;margin-top:2px">${esc(r.realizado_por?.toUpperCase())}</div>
    </div>
    <div>${bloqueFirma(firma, 'AUTORIZADO POR')}</div>
  </div>
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
