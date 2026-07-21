import type { Cotizacion, ConfigCotizacion } from '@/types'
import type { PrintEmpresa } from './printVenta'

export type { PrintEmpresa }

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const fmt = (n: number) =>
  'L ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const NAVY = '#072B5A'
const BLUE = '#0E78D8'
const CYAN = '#38D6D4'

function empresaHeader(e: PrintEmpresa, logoSrc?: string): string {
  const fiscal = [
    e.nombre_legal && e.nombre_legal !== e.nombre ? `<div style="font-size:11px;color:#555;margin-top:1px">${e.nombre_legal}</div>` : '',
    e.rtn       ? `<div style="font-size:11px;color:#888;margin-top:2px">RTN: ${e.rtn}</div>` : '',
    e.telefono  ? `<div style="font-size:11px;color:#888">${e.telefono}${e.correo ? ` · ${e.correo}` : ''}</div>` : (e.correo ? `<div style="font-size:11px;color:#888">${e.correo}</div>` : ''),
    e.direccion ? `<div style="font-size:11px;color:#888">${e.direccion}</div>` : '',
  ].filter(Boolean).join('')

  return `
    ${logoSrc
      ? `<img src="${logoSrc}" style="height:48px;max-width:150px;object-fit:contain;display:block;margin-bottom:8px" alt="Logo">`
      : `<div style="width:40px;height:40px;background:linear-gradient(135deg,${BLUE},${CYAN});border-radius:9px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px"><span style="color:#fff;font-size:18px;font-weight:700">V</span></div>`
    }
    <div style="font-size:17px;font-weight:700;color:${NAVY}">${e.nombre}</div>
    ${fiscal}
  `
}

export function printCotizacion(c: Cotizacion, empresa: PrintEmpresa, logoSrc?: string, configCot?: ConfigCotizacion): void {
  const detalles          = c.detalles ?? []
  const mostrarDesc       = configCot?.mostrar_descripcion ?? false
  const mostrarFoto       = configCot?.mostrar_foto ?? false

  const filas = detalles.map((d, i) => {
    const imgUrl = d.producto?.imagen_url
      ? (d.producto.imagen_url.startsWith('http') ? d.producto.imagen_url : `${API_BASE}${d.producto.imagen_url}`)
      : null
    const fotoHtml = mostrarFoto && imgUrl
      ? `<img src="${imgUrl}" style="width:44px;height:44px;object-fit:contain;border-radius:6px;border:1px solid #E5E9EE;display:block;margin-bottom:4px" alt="">`
      : ''
    const descHtml = mostrarDesc && d.producto?.descripcion
      ? `<span style="color:#888;font-size:11px;display:block;margin-top:3px;line-height:1.4">${d.producto.descripcion}</span>`
      : ''
    return `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F4F7FA'}">
      <td style="padding:8px 12px">
        ${fotoHtml}
        <strong style="color:${NAVY};font-size:13px">${d.producto?.nombre ?? 'Producto'}</strong>
        ${d.producto?.codigo ? `<br><span style="color:#888;font-size:11px;font-family:monospace">${d.producto.codigo}</span>` : ''}
        ${descHtml}
      </td>
      <td style="padding:8px 12px;text-align:center;color:#555;font-size:13px">${Number(d.cantidad).toFixed(2)}</td>
      <td style="padding:8px 12px;text-align:right;color:#555;font-size:13px">${fmt(d.precio_unitario)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:700;color:${NAVY};font-size:13px">${fmt(d.subtotal)}</td>
    </tr>`
  }).join('')

  const filaDescuento = c.descuento > 0
    ? `<tr><td colspan="2"></td><td style="padding:4px 12px;color:#888;text-align:right">Descuento</td><td style="padding:4px 12px;text-align:right;color:#dc2626;font-weight:600">− ${fmt(c.descuento)}</td></tr>`
    : ''

  const isvPct = empresa.isv_rate ?? 15
  const filaISV = c.impuesto > 0
    ? `<tr><td colspan="2"></td><td style="padding:4px 12px;color:#888;text-align:right">ISV (${isvPct}%)</td><td style="padding:4px 12px;text-align:right;color:#555">${fmt(c.impuesto)}</td></tr>`
    : ''

  const obsBlock = c.observaciones ? `
    <div style="margin-top:28px;padding:14px 16px;border-left:4px solid ${BLUE};background:#F4F7FA;border-radius:4px">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.6px">Observaciones</p>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.6">${c.observaciones}</p>
    </div>` : ''

  const estados: Record<string, string> = {
    borrador: 'BORRADOR', enviada: 'ENVIADA', aprobada: 'APROBADA',
    rechazada: 'RECHAZADA', convertida: 'CONVERTIDA', vencida: 'VENCIDA',
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${c.numero_cotizacion} — Cotización</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #333; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 20mm 16mm; }
      .no-print { display: none !important; }
    }
    .page { max-width: 760px; margin: 0 auto; padding: 40px 32px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
<div class="page">

  <div class="no-print" style="text-align:right;margin-bottom:20px">
    <button onclick="window.print()" style="background:${BLUE};color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">
      🖨️ Guardar / Imprimir PDF
    </button>
  </div>

  <!-- HEADER -->
  <table style="margin-bottom:24px">
    <tr>
      <td>${empresaHeader(empresa, logoSrc)}</td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:26px;font-weight:800;color:${BLUE};letter-spacing:2px">COTIZACIÓN</div>
        <div style="font-size:16px;font-weight:700;color:${NAVY};margin-top:4px">${c.numero_cotizacion}</div>
        <div style="font-size:11px;color:#888;margin-top:3px">${estados[c.estado] ?? c.estado}</div>
      </td>
    </tr>
  </table>

  <div style="height:3px;background:linear-gradient(90deg,${NAVY},${BLUE},${CYAN});border-radius:2px;margin-bottom:20px"></div>

  <!-- INFO GRID -->
  <table style="margin-bottom:20px;border-spacing:0">
    <tr>
      <td style="width:33%;padding:10px 12px;background:#F4F7FA;border-radius:6px 0 0 6px;border-right:2px solid #fff">
        <div style="font-size:9px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Cotizado para</div>
        <div style="font-size:14px;font-weight:700;color:${NAVY}">${c.cliente?.nombre ?? 'Consumidor general'}</div>
      </td>
      <td style="width:33%;padding:10px 12px;background:#F4F7FA;border-right:2px solid #fff">
        <div style="font-size:9px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Fecha de emisión</div>
        <div style="font-size:14px;font-weight:700;color:${NAVY}">${c.fecha_cotizacion}</div>
      </td>
      <td style="width:33%;padding:10px 12px;background:#F4F7FA;border-radius:0 6px 6px 0">
        <div style="font-size:9px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Válida hasta</div>
        <div style="font-size:14px;font-weight:700;color:${c.fecha_vencimiento ? NAVY : '#aaa'}">${c.fecha_vencimiento ?? '—'}</div>
      </td>
    </tr>
  </table>

  <!-- TABLA DE PRODUCTOS -->
  <table style="border-radius:8px;overflow:hidden;margin-bottom:16px">
    <thead>
      <tr style="background:${NAVY}">
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Descripción</th>
        <th style="padding:10px 12px;text-align:center;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.5px;width:80px">Cant.</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.5px;width:130px">Precio unit.</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.5px;width:130px">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${filas || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#aaa">Sin productos</td></tr>`}
    </tbody>
    <tfoot style="border-top:2px solid #E5E9EE">
      <tr><td colspan="2"></td>
        <td style="padding:6px 12px;color:#888;text-align:right;font-size:13px">Subtotal</td>
        <td style="padding:6px 12px;text-align:right;font-size:13px;color:#555">${fmt(c.subtotal)}</td>
      </tr>
      ${filaDescuento}
      ${filaISV}
      <tr style="border-top:2px solid ${NAVY}">
        <td colspan="2"></td>
        <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:${NAVY}">TOTAL</td>
        <td style="padding:10px 12px;text-align:right;font-size:16px;font-weight:700;color:${NAVY}">${fmt(c.total)}</td>
      </tr>
    </tfoot>
  </table>

  ${obsBlock}

  <!-- FOOTER -->
  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #E5E9EE;text-align:center">
    <span style="font-size:10px;color:#aaa">${empresa.nombre} · ${c.numero_cotizacion}</span>
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
