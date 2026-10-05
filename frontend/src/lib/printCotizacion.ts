import type { Cotizacion, ConfigCotizacion, DatosFirma } from '@/types'
import { type PrintEmpresa } from './printVenta'
import { numeroALetras } from './numeroALetras'
import { bloqueFirma } from './firmaDocumento'

// Los artículos libres llevan texto escrito a mano: escaparlo antes de meterlo en el HTML
const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type { PrintEmpresa }

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const num = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** YYYY-MM-DD → DD/MM/YYYY */
const fecha = (f?: string | null) => {
  const m = f?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f ?? '')
}

export async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

export async function printCotizacion(c: Cotizacion, empresa: PrintEmpresa, logoSrc?: string, configCot?: ConfigCotizacion, firma?: DatosFirma | null): Promise<void> {
  const detalles    = c.detalles ?? []
  const mostrarDesc = configCot?.mostrar_descripcion ?? false
  const mostrarFoto = configCot?.mostrar_foto ?? false
  const isvPct      = empresa.isv_rate ?? 15

  /* ── Pre-cargar imágenes de productos como base64 ─────────── */
  const imageMap = new Map<number, string>()
  if (mostrarFoto) {
    await Promise.all(
      detalles
        .filter(d => d.producto?.imagen_url && d.producto?.id != null)
        .map(async d => {
          const rawUrl = d.producto!.imagen_url!
          const absUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE}${rawUrl}`
          const b64 = await fetchBase64(absUrl)
          if (b64) imageMap.set(d.producto!.id, b64)
        })
    )
  }

  const estados: Record<string, string> = {
    borrador: 'BORRADOR', enviada: 'ENVIADA', aprobada: 'APROBADA',
    rechazada: 'RECHAZADA', convertida: 'CONVERTIDA', vencida: 'VENCIDA',
  }
  const estado = estados[c.estado] ?? c.estado.toUpperCase()
  const esc = (t?: string | null) => escapeHtml(t ?? '')

  /* ── Filas de productos ─────────────────────────────────── */
  const filas = detalles.map(d => {
    const imgSrc = mostrarFoto && d.producto?.id != null ? imageMap.get(d.producto.id) : null
    const descHtml = mostrarDesc && d.producto?.descripcion
      ? `<div class="desc">${esc(d.producto.descripcion)}</div>`
      : ''
    const fotoCelda = mostrarFoto
      ? `<td class="c">${imgSrc ? `<img src="${imgSrc}" class="foto" alt="">` : '<div class="foto vacia"></div>'}</td>`
      : ''
    const cant = Number(d.cantidad) % 1 === 0 ? Number(d.cantidad) : num(d.cantidad)
    return `
      <tr>
        ${fotoCelda}
        <td class="c">${cant}</td>
        <td>${d.producto?.codigo ? `<span class="cod">${esc(d.producto.codigo)}</span> ` : ''}${esc(d.producto?.nombre ?? d.descripcion ?? 'Producto')}${descHtml}</td>
        <td class="r">${num(d.precio_unitario)}</td>
        <td class="r">${num(d.subtotal)}</td>
      </tr>`
  }).join('')

  // Alto vacío para que el cuadro de productos llene la página (aprox. en mm)
  const altoFila = mostrarFoto ? 19 : mostrarDesc ? 9 : 5.6
  const relleno = Math.max(6, 128 - detalles.length * altoFila - (c.observaciones ? 14 : 0) - (firma ? 28 : 0))

  /* ── Empresa ────────────────────────────────────────────── */
  const datosEmpresa = [
    `<div class="razon">${esc(empresa.nombre_legal || empresa.nombre)}</div>`,
    empresa.rtn       ? `<div class="b">R.T.N.: ${esc(empresa.rtn)}</div>` : '',
    empresa.direccion ? `<div>${esc(empresa.direccion)}</div>` : '',
    empresa.telefono  ? `<div>TEL.: ${esc(empresa.telefono)}</div>` : '',
    empresa.correo    ? `<div>Correo electrónico: ${esc(empresa.correo)}</div>` : '',
  ].filter(Boolean).join('')

  /* ── Cliente ────────────────────────────────────────────── */
  const cli = c.cliente as (typeof c.cliente & { rtn?: string; telefono?: string; direccion?: string; correo?: string }) | undefined
  const clienteExtra = [cli?.direccion, cli?.telefono ? `Tel.: ${cli.telefono}` : '', cli?.correo]
    .filter(Boolean).map(t => esc(t)).join(' · ')

  /* ── Totales ────────────────────────────────────────────── */
  const fila = (label: string, valor: number, cls = '') =>
    `<tr class="${cls}"><th>${label}</th><td class="l">L.</td><td class="v">${num(valor)}</td></tr>`
  const filasTotales = [
    fila('SUB TOTAL', c.subtotal),
    c.descuento > 0 ? fila('DESCUENTOS Y REBAJAS', c.descuento) : '',
    fila(`I.S.V. ${isvPct}%`, c.impuesto),
    fila('TOTAL', c.total, 'total'),
  ].join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(c.numero_cotizacion)} — Cotización</title>
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
    .doc { text-align: right; display: flex; flex-direction: column; justify-content: space-between; min-width: 72mm; }
    .doc h1 { font-size: 18px; letter-spacing: 1px; }
    .doc .no { font-size: 22px; white-space: nowrap; }
    .doc .no small { font-size: 11px; font-weight: 700; }
    .doc .estado { font-size: 9.5px; font-weight: 700; color: #555; margin-top: 2px; letter-spacing: .5px; }
    .doc .linea { font-size: 11px; margin-top: 6px; text-align: left; display: flex; gap: 6px; align-items: flex-end; }
    .doc .linea b { white-space: nowrap; font-weight: 400; }
    .doc .linea span { flex: 1; border-bottom: 1px solid #999; padding: 0 4px 1px; font-size: 12px; }

    .cliente { margin-top: 12px; display: flex; align-items: stretch; border: 1px solid #999; border-radius: 6px; overflow: hidden; }
    .cliente .tag { background: #333; color: #fff; font-weight: 700; padding: 9px 12px; font-size: 11px; }
    .cliente .nom { flex: 1; padding: 9px 12px; font-size: 12px; }
    .cliente .rtn { padding: 9px 14px; font-size: 12px; white-space: nowrap; }
    .cliente .rtn b { font-size: 10px; margin-right: 8px; }
    .cli-extra { font-size: 10px; color: #555; margin: 4px 2px 0; }

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
    .det .desc { font-size: 9.5px; color: #666; margin-top: 2px; line-height: 1.35; }
    .det .foto { width: 60px; height: 60px; object-fit: contain; display: inline-block; border: 1px solid #ddd; border-radius: 4px; }
    .det .foto.vacia { background: #f4f4f4; }

    .bottom { display: flex; gap: 10mm; margin-top: auto; padding-top: 12px; align-items: flex-start; }
    .izq { flex: 1.15; }
    .letras { background: #D1D3D4; border: 1px solid #aaa; border-radius: 12px; padding: 4px 12px 8px; min-height: 12mm; }
    .letras small { font-size: 8px; font-weight: 700; display: block; margin-bottom: 3px; }
    .letras div { font-size: 11px; font-weight: 700; }
    .firma { margin-top: 10px; text-align: center; }

    .tot { flex: 1; }
    .tot table { width: 100%; }
    .tot th { text-align: right; font-size: 10px; font-weight: 700; padding: 0 4px; white-space: nowrap; }
    .tot td.l { width: 14px; font-size: 10px; font-weight: 700; }
    .tot td.v { background: #D1D3D4; border: 1px solid #aaa; text-align: right; padding: 3px 8px; font-size: 11px; width: 40%; }
    .tot tr.total th, .tot tr.total td.l { color: #C0392B; font-size: 12px; padding-top: 4px; }
    .tot tr.total td.v { background: #fff; font-weight: 700; font-size: 13px; }

    .pie { margin-top: 14px; display: flex; justify-content: space-between; font-size: 10px; color: #555; }
    .pie b { font-size: 11px; color: #333; letter-spacing: .3px; }
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
        <h1>COTIZACIÓN</h1>
        <div class="no"><small>No.</small> ${esc(c.numero_cotizacion)}</div>
        <div class="estado">${estado}</div>
      </div>
      <div>
        <div class="linea"><b>FECHA:</b> <span>${fecha(c.fecha_cotizacion)}</span></div>
        <div class="linea"><b>VÁLIDA HASTA:</b> <span>${c.fecha_vencimiento ? fecha(c.fecha_vencimiento) : 'Sin vencimiento'}</span></div>
      </div>
    </div>
  </div>

  <div class="cliente">
    <div class="tag">CLIENTE:</div>
    <div class="nom">${esc(cli?.nombre ?? 'CONSUMIDOR FINAL')}</div>
    <div class="rtn"><b>R.T.N.:</b>${esc(cli?.rtn)}</div>
  </div>
  ${clienteExtra ? `<div class="cli-extra">${clienteExtra}</div>` : ''}

  ${c.observaciones ? `
  <div class="obs">
    <small>COMENTARIOS O INSTRUCCIONES ESPECIALES:</small>
    <p>${esc(c.observaciones)}</p>
  </div>` : ''}

  <div class="det">
    <table>
      <thead>
        <tr>
          ${mostrarFoto ? '<th style="width:76px">FOTO</th>' : ''}
          <th style="width:11%">CANTIDAD</th>
          <th style="letter-spacing:6px">DESCRIPCION</th>
          <th style="width:15%">PRECIO<br>UNITARIO</th>
          <th style="width:16%">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        <tr class="relleno" style="height:${relleno}mm">${mostrarFoto ? '<td></td>' : ''}<td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>

  <div class="bottom">
    <div class="izq">
      <div class="letras">
        <small>VALOR EN LETRAS:</small>
        <div>${numeroALetras(c.total)}</div>
      </div>
      ${firma ? `<div class="firma">${bloqueFirma(firma, 'Autorizado por')}</div>` : ''}
    </div>
    <div class="tot">
      <table>${filasTotales}</table>
    </div>
  </div>

  <div class="pie">
    <span>Precios sujetos a cambio sin previo aviso. Este documento no es una factura.</span>
    <b>¡GRACIAS POR SU PREFERENCIA!</b>
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
