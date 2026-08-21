import type { Cotizacion, ConfigCotizacion } from '@/types'
import type { PrintEmpresa } from './printVenta'

export type { PrintEmpresa }

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const fmt = (n: number) =>
  'L ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const NAVY = '#072B5A'
const BLUE = '#0E78D8'
const CYAN = '#38D6D4'

async function fetchBase64(url: string): Promise<string | null> {
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

export async function printCotizacion(c: Cotizacion, empresa: PrintEmpresa, logoSrc?: string, configCot?: ConfigCotizacion): Promise<void> {
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

  const estados: Record<string, { label: string; color: string }> = {
    borrador:   { label: 'BORRADOR',   color: '#6B7280' },
    enviada:    { label: 'ENVIADA',    color: '#0E78D8' },
    aprobada:   { label: 'APROBADA',   color: '#059669' },
    rechazada:  { label: 'RECHAZADA',  color: '#DC2626' },
    convertida: { label: 'CONVERTIDA', color: '#7C3AED' },
    vencida:    { label: 'VENCIDA',    color: '#D97706' },
  }
  const estadoInfo = estados[c.estado] ?? { label: c.estado.toUpperCase(), color: '#6B7280' }

  /* ── Filas de productos ─────────────────────────────────── */
  const filas = detalles.map((d, i) => {
    const imgSrc = mostrarFoto && d.producto?.id != null ? imageMap.get(d.producto.id) : null
    const descHtml = mostrarDesc && d.producto?.descripcion
      ? `<div style="color:#888;font-size:10.5px;margin-top:2px;line-height:1.4">${d.producto.descripcion}</div>`
      : ''

    const bg = i % 2 === 0 ? '#ffffff' : '#F4F7FA'
    const fotoCelda = mostrarFoto
      ? `<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #EEF0F4;width:80px">
          ${imgSrc
            ? `<img src="${imgSrc}" style="width:60px;height:60px;object-fit:contain;border-radius:6px;border:1px solid #E5E9EE;display:inline-block" alt="">`
            : `<div style="width:60px;height:60px;border-radius:6px;border:1px solid #E5E9EE;background:#F4F7FA;display:inline-block"></div>`
          }
        </td>`
      : ''
    return `
    <tr style="background:${bg}">
      ${fotoCelda}
      <td style="padding:9px 10px;text-align:center;color:#555;font-size:12px;border-bottom:1px solid #EEF0F4">${Number(d.cantidad).toFixed(2)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #EEF0F4">
        <span style="color:${NAVY};font-size:12.5px;font-weight:600">${d.producto?.nombre ?? 'Producto'}</span>
        ${d.producto?.codigo ? `<span style="color:#aaa;font-size:10px;font-family:monospace;margin-left:5px">[${d.producto.codigo}]</span>` : ''}
        ${descHtml}
      </td>
      <td style="padding:9px 10px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #EEF0F4">${fmt(d.precio_unitario)}</td>
      <td style="padding:9px 10px;text-align:center;color:#555;font-size:12px;border-bottom:1px solid #EEF0F4">${isvPct}%</td>
      <td style="padding:9px 10px;text-align:right;font-weight:700;color:${NAVY};font-size:12.5px;border-bottom:1px solid #EEF0F4">${fmt(d.subtotal)}</td>
    </tr>`
  }).join('')

  /* ── Logo o inicial ─────────────────────────────────────── */
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="height:52px;max-width:160px;object-fit:contain;display:block;margin-bottom:6px" alt="Logo">`
    : `<div style="width:44px;height:44px;background:linear-gradient(135deg,${BLUE},${CYAN});border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:6px"><span style="color:#fff;font-size:20px;font-weight:700">${empresa.nombre[0].toUpperCase()}</span></div>`

  /* ── Datos fiscales empresa ─────────────────────────────── */
  const empresaFiscal = [
    empresa.nombre_legal && empresa.nombre_legal !== empresa.nombre
      ? `<div style="font-size:10.5px;color:#555;margin-top:1px;font-style:italic">${empresa.nombre_legal}</div>` : '',
    empresa.rtn       ? `<div style="font-size:10.5px;color:#666;margin-top:2px">RTN: ${empresa.rtn}</div>` : '',
    empresa.direccion ? `<div style="font-size:10.5px;color:#666;margin-top:1px">${empresa.direccion}</div>` : '',
    empresa.telefono  ? `<div style="font-size:10.5px;color:#666;margin-top:1px">Tel: ${empresa.telefono}${empresa.correo ? `  ·  ${empresa.correo}` : ''}</div>`
                      : (empresa.correo ? `<div style="font-size:10.5px;color:#666;margin-top:1px">${empresa.correo}</div>` : ''),
  ].filter(Boolean).join('')

  /* ── Datos del cliente ──────────────────────────────────── */
  const cli = c.cliente as (typeof c.cliente & { rtn?: string; telefono?: string; direccion?: string; correo?: string }) | undefined
  const clienteDetalle = [
    cli?.rtn       ? `<div style="font-size:11px;color:#555;margin-top:2px">RTN: ${cli.rtn}</div>` : '',
    cli?.direccion ? `<div style="font-size:11px;color:#555;margin-top:1px">${cli.direccion}</div>` : '',
    cli?.telefono  ? `<div style="font-size:11px;color:#555;margin-top:1px">Tel: ${cli.telefono}</div>` : '',
    cli?.correo    ? `<div style="font-size:11px;color:#555;margin-top:1px">${cli.correo}</div>` : '',
  ].filter(Boolean).join('')

  /* ── Observaciones ──────────────────────────────────────── */
  const obsBlock = c.observaciones ? `
    <div style="margin-bottom:18px;padding:12px 14px;border-left:4px solid ${BLUE};background:#F4F7FA;border-radius:4px">
      <p style="margin:0 0 4px;font-size:9.5px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.6px">Comentarios o instrucciones especiales</p>
      <p style="margin:0;font-size:12px;color:#444;line-height:1.6">${c.observaciones}</p>
    </div>` : ''

  /* ── Totales ────────────────────────────────────────────── */
  const filaDescuento = c.descuento > 0
    ? `<tr>
        <td style="padding:5px 14px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #F0F2F5">Descuento</td>
        <td style="padding:5px 14px;text-align:right;color:#DC2626;font-weight:600;font-size:12px;border-bottom:1px solid #F0F2F5">− ${fmt(c.descuento)}</td>
       </tr>` : ''

  const filaISV = c.impuesto > 0
    ? `<tr>
        <td style="padding:5px 14px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #F0F2F5">ISV (${isvPct}%)</td>
        <td style="padding:5px 14px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #F0F2F5">${fmt(c.impuesto)}</td>
       </tr>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${c.numero_cotizacion} — Cotización</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Arial, Helvetica, sans-serif; color: #333; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 12mm 14mm; }
      .no-print { display: none !important; }
    }
    .page {
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
      padding: 28px 32px 24px;
      display: flex;
      flex-direction: column;
      min-height: calc(297mm - 24mm); /* A4 menos márgenes de impresión */
    }
    table { width: 100%; border-collapse: collapse; }
    .label { font-size: 9px; font-weight: 700; color: ${BLUE}; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 3px; }
    .value { font-size: 13px; font-weight: 700; color: ${NAVY}; }
    /* La sección de la tabla crece para llenar el espacio disponible */
    .tabla-section { flex: 1; display: flex; flex-direction: column; }
    .tabla-productos { flex: 1; height: 100%; border-collapse: collapse; width: 100%; }
    /* Fila vacía que absorbe el espacio sobrante */
    .filler-row { height: 100%; }
    .filler-row td { border-left: 1px solid #E5E9EE; border-right: 1px solid #E5E9EE; }
    .filler-row td:first-child { border-left: none; }
    .filler-row td:last-child  { border-right: none; }
  </style>
</head>
<body>
<div class="page">

  <div class="no-print" style="text-align:right;margin-bottom:16px">
    <button onclick="window.print()" style="background:${BLUE};color:#fff;border:none;padding:9px 22px;border-radius:7px;font-size:13px;cursor:pointer;font-weight:600">
      🖨️ Guardar / Imprimir PDF
    </button>
  </div>

  <!-- ═══ ENCABEZADO ═══ -->
  <table style="margin-bottom:0">
    <tr>
      <td style="width:55%;vertical-align:top;padding-right:20px">
        ${logoHtml}
        <div style="font-size:18px;font-weight:800;color:${NAVY};margin-bottom:3px">${empresa.nombre}</div>
        ${empresaFiscal}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:40px;font-weight:900;color:${BLUE};letter-spacing:1px;line-height:1">Cotización</div>
        <div style="margin-top:10px;display:inline-block;text-align:left;min-width:200px">
          <table style="width:auto;margin-left:auto">
            <tr>
              <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">FECHA</td>
              <td style="font-size:10.5px;font-weight:700;color:${NAVY};padding:2px 0">${c.fecha_cotizacion}</td>
            </tr>
            <tr>
              <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">N.° COTIZACIÓN</td>
              <td style="font-size:10.5px;font-weight:700;color:${NAVY};padding:2px 0">${c.numero_cotizacion}</td>
            </tr>
            <tr>
              <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">ESTADO</td>
              <td style="padding:2px 0">
                <span style="font-size:9.5px;font-weight:700;color:#fff;background:${estadoInfo.color};padding:2px 8px;border-radius:20px">${estadoInfo.label}</span>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- Barra de color -->
  <div style="height:3px;background:linear-gradient(90deg,${NAVY},${BLUE},${CYAN});border-radius:2px;margin:12px 0 14px"></div>

  <!-- ═══ CLIENTE + VALIDEZ ═══ -->
  <table style="margin-bottom:14px">
    <tr style="vertical-align:top">
      <td style="width:55%;padding-right:20px">
        <div style="font-size:10px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;border-bottom:2px solid ${BLUE};padding-bottom:3px;display:inline-block">Cotización para:</div>
        <div style="font-size:14px;font-weight:700;color:${NAVY};margin-top:4px">${cli?.nombre ?? 'Consumidor general'}</div>
        ${clienteDetalle}
      </td>
      <td style="vertical-align:top">
        <table style="width:100%">
          <tr>
            <td style="background:#F4F7FA;padding:9px 14px;border-radius:6px 6px 0 0;border-bottom:2px solid #fff">
              <div class="label">Válida hasta</div>
              <div class="value" style="color:${c.fecha_vencimiento ? NAVY : '#bbb'}">${c.fecha_vencimiento ?? 'Sin vencimiento'}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#F4F7FA;padding:9px 14px;border-radius:0 0 6px 6px">
              <div class="label">Tasa ISV</div>
              <div class="value">${isvPct}%</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Observaciones -->
  ${obsBlock}

  <!-- ═══ TABLA DE PRODUCTOS (flex:1 → llena el resto de la página) ═══ -->
  <div class="tabla-section">
    <table class="tabla-productos">
      <thead>
        <tr style="background:${NAVY}">
          ${mostrarFoto ? `<th style="padding:10px;text-align:center;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;width:80px">Foto</th>` : ''}
          <th style="padding:10px;text-align:center;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;width:65px">Cantidad</th>
          <th style="padding:10px;text-align:left;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px">Descripción</th>
          <th style="padding:10px;text-align:right;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;width:110px">Precio unit.</th>
          <th style="padding:10px;text-align:center;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;width:70px">ISV %</th>
          <th style="padding:10px;text-align:right;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;width:110px">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        <!-- Fila vacía que estira la tabla hasta llenar la página -->
        <tr class="filler-row">
          ${mostrarFoto ? `<td style="border-bottom:1px solid #E5E9EE"></td>` : ''}
          <td style="border-bottom:1px solid #E5E9EE"></td>
          <td style="border-bottom:1px solid #E5E9EE"></td>
          <td style="border-bottom:1px solid #E5E9EE"></td>
          <td style="border-bottom:1px solid #E5E9EE"></td>
          <td style="border-bottom:1px solid #E5E9EE"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ TOTALES ═══ -->
  <table style="margin-top:0;margin-bottom:20px">
    <tr>
      <td style="width:55%"></td>
      <td>
        <table style="width:100%;border:1px solid #E5E9EE;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
          <tr>
            <td style="padding:6px 14px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #F0F2F5">Subtotal</td>
            <td style="padding:6px 14px;text-align:right;color:#555;font-size:12px;border-bottom:1px solid #F0F2F5;width:110px">${fmt(c.subtotal)}</td>
          </tr>
          ${filaDescuento}
          ${filaISV}
          <tr style="background:${NAVY}">
            <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#fff">TOTAL</td>
            <td style="padding:10px 14px;text-align:right;font-size:15px;font-weight:800;color:#fff">${fmt(c.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ FOOTER ═══ -->
  <div style="border-top:1px solid #E5E9EE;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#aaa">
      ${empresa.nombre}${empresa.telefono ? ` · Tel: ${empresa.telefono}` : ''}${empresa.correo ? ` · ${empresa.correo}` : ''}
    </div>
    <div style="font-size:11px;font-weight:700;color:${BLUE};letter-spacing:.5px">¡GRACIAS POR SU PREFERENCIA!</div>
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
