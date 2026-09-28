import type { Requisicion, DatosFirma } from '@/types'
import { coloresDocumento, type PrintEmpresa } from './printVenta'
import { fetchBase64 } from './printCotizacion'
import { bloqueFirma } from './firmaDocumento'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Descripciones y códigos de artículos libres se escriben a mano: escaparlos
const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmtCant = (n: number) => Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2)

export async function printRequisicion(r: Requisicion, empresa: PrintEmpresa, logoSrc?: string, firma?: DatosFirma | null): Promise<void> {
  const { NAVY, BLUE } = coloresDocumento(empresa)
  const detalles = r.detalles ?? []

  /* ── Fotos como base64 (evita bloqueo CORS en la ventana blob) ── */
  const fotos = await Promise.all(detalles.map(d => {
    if (!d.imagen_url) return Promise.resolve(null)
    return fetchBase64(d.imagen_url.startsWith('http') ? d.imagen_url : `${API_BASE}${d.imagen_url}`)
  }))

  const estados: Record<string, { label: string; color: string }> = {
    borrador:  { label: 'BORRADOR',  color: '#6B7280' },
    enviada:   { label: 'ENVIADA',   color: BLUE },
    recibida:  { label: 'RECIBIDA',  color: '#059669' },
    cancelada: { label: 'CANCELADA', color: '#DC2626' },
  }
  const estadoInfo = estados[r.estado] ?? { label: r.estado.toUpperCase(), color: '#6B7280' }

  /* ── Filas ──────────────────────────────────────────────── */
  const filas = detalles.map((d, i) => {
    const foto = fotos[i]
    return `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F4F7FA'}">
      <td style="padding:9px 10px;border-bottom:1px solid #EEF0F4;font-family:monospace;font-size:12px;font-weight:700;color:${NAVY};white-space:nowrap">${d.codigo ? escapeHtml(d.codigo) : '—'}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #EEF0F4;width:90px">
        ${foto
          ? `<img src="${foto}" style="width:70px;height:70px;object-fit:contain;border-radius:6px;border:1px solid #E5E9EE;display:inline-block" alt="">`
          : `<div style="width:70px;height:70px;border-radius:6px;border:1px solid #E5E9EE;background:#F4F7FA;display:inline-block"></div>`}
      </td>
      <td style="padding:9px 10px;border-bottom:1px solid #EEF0F4;color:${NAVY};font-size:12.5px;font-weight:600">${escapeHtml(d.descripcion ?? '')}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #EEF0F4;text-align:center;color:${NAVY};font-size:13px;font-weight:700">${fmtCant(d.cantidad)}</td>
    </tr>`
  }).join('')

  /* ── Logo o inicial ─────────────────────────────────────── */
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="height:52px;max-width:160px;object-fit:contain;display:block;margin-bottom:6px" alt="Logo">`
    : `<div style="width:44px;height:44px;background:linear-gradient(135deg,${BLUE},${NAVY});border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:6px"><span style="color:#fff;font-size:20px;font-weight:700">${empresa.nombre[0].toUpperCase()}</span></div>`

  const empresaDatos = [
    empresa.nombre_legal && empresa.nombre_legal !== empresa.nombre
      ? `<div style="font-size:10.5px;color:#555;margin-top:1px;font-style:italic">${empresa.nombre_legal}</div>` : '',
    empresa.rtn       ? `<div style="font-size:10.5px;color:#666;margin-top:2px">RTN: ${empresa.rtn}</div>` : '',
    empresa.direccion ? `<div style="font-size:10.5px;color:#666;margin-top:1px">Dirección: ${empresa.direccion}</div>` : '',
    empresa.telefono  ? `<div style="font-size:10.5px;color:#666;margin-top:1px">Tel. ${empresa.telefono}${empresa.correo ? `  ·  ${empresa.correo}` : ''}</div>`
                      : (empresa.correo ? `<div style="font-size:10.5px;color:#666;margin-top:1px">${empresa.correo}</div>` : ''),
  ].filter(Boolean).join('')

  /* ── Proveedor ──────────────────────────────────────────── */
  const prov = r.proveedor
  const proveedorDatos = prov ? [
    prov.rtn       ? `<div style="font-size:11px;color:#555;margin-top:2px">RTN: ${prov.rtn}</div>` : '',
    prov.direccion ? `<div style="font-size:11px;color:#555;margin-top:1px">${prov.direccion}</div>` : '',
    prov.telefono  ? `<div style="font-size:11px;color:#555;margin-top:1px">Tel: ${prov.telefono}</div>` : '',
    prov.correo    ? `<div style="font-size:11px;color:#555;margin-top:1px">${prov.correo}</div>` : '',
  ].filter(Boolean).join('') : ''

  const obsBlock = r.observaciones ? `
    <div style="margin-bottom:14px;padding:12px 14px;border-left:4px solid ${BLUE};background:#F4F7FA;border-radius:4px">
      <p style="margin:0 0 4px;font-size:9.5px;font-weight:700;color:${BLUE};text-transform:uppercase;letter-spacing:.6px">Observaciones</p>
      <p style="margin:0;font-size:12px;color:#444;line-height:1.6">${escapeHtml(r.observaciones)}</p>
    </div>` : ''

  const totalUnidades = detalles.reduce((s, d) => s + Number(d.cantidad), 0)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${r.numero_requisicion} — Requisición</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Arial, Helvetica, sans-serif; color: #333; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 12mm 14mm; }
      .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
    }
    .page { width: 100%; max-width: 780px; margin: 0 auto; padding: 28px 32px 24px; display: flex; flex-direction: column; min-height: calc(297mm - 24mm); }
    table { width: 100%; border-collapse: collapse; }
    .tabla-section { flex: 1; display: flex; flex-direction: column; }
    .tabla-productos { flex: 1; height: 100%; }
    .filler-row { height: 100%; }
    th { padding: 10px; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; }
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
  <table>
    <tr>
      <td style="width:55%;vertical-align:top;padding-right:20px">
        ${logoHtml}
        <div style="font-size:18px;font-weight:800;color:${NAVY};margin-bottom:3px">${empresa.nombre}</div>
        ${empresaDatos}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:36px;font-weight:900;color:${BLUE};letter-spacing:1px;line-height:1">Requisición</div>
        <table style="width:auto;margin:10px 0 0 auto">
          <tr>
            <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">FECHA</td>
            <td style="font-size:10.5px;font-weight:700;color:${NAVY};padding:2px 0">${r.fecha_requisicion}</td>
          </tr>
          <tr>
            <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">N.° DE PEDIDO</td>
            <td style="font-size:10.5px;font-weight:700;color:${NAVY};padding:2px 0">${r.numero_requisicion}</td>
          </tr>
          <tr>
            <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">REALIZADO POR</td>
            <td style="font-size:10.5px;font-weight:700;color:${NAVY};padding:2px 0">${r.realizado_por ? escapeHtml(r.realizado_por) : '—'}</td>
          </tr>
          <tr>
            <td style="font-size:10.5px;color:#888;padding:2px 8px 2px 0;white-space:nowrap">ESTADO</td>
            <td style="padding:2px 0"><span style="font-size:9.5px;font-weight:700;color:#fff;background:${estadoInfo.color};padding:2px 8px;border-radius:20px">${estadoInfo.label}</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="height:3px;background:linear-gradient(90deg,${NAVY},${BLUE});border-radius:2px;margin:12px 0 14px"></div>

  <!-- ═══ PROVEEDOR ═══ -->
  <div style="margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${BLUE};padding-bottom:3px;display:inline-block">Proveedor:</div>
    <div style="font-size:14px;font-weight:700;color:${NAVY};margin-top:4px">${prov?.nombre ?? '—'}</div>
    ${proveedorDatos}
  </div>

  ${obsBlock}

  <!-- ═══ DETALLE ═══ -->
  <div class="tabla-section">
    <table class="tabla-productos">
      <thead>
        <tr style="background:${NAVY}">
          <th style="text-align:left;width:120px">Código</th>
          <th style="text-align:center;width:90px">Foto</th>
          <th style="text-align:left">Descripción</th>
          <th style="text-align:center;width:90px">Cantidad</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        <tr class="filler-row"><td></td><td></td><td></td><td></td></tr>
      </tbody>
      <tfoot>
        <tr style="background:${NAVY}">
          <td colspan="3" style="padding:9px 10px;text-align:right;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Total unidades (${detalles.length} artículo${detalles.length === 1 ? '' : 's'})</td>
          <td style="padding:9px 10px;text-align:center;color:#fff;font-size:13px;font-weight:800">${fmtCant(totalUnidades)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- ═══ FIRMAS ═══ -->
  <table style="margin-top:48px">
    <tr>
      <td style="width:50%;padding:0 30px;text-align:center;vertical-align:bottom">
        <div style="border-top:1px solid #999;padding-top:6px;font-size:10.5px;color:#555">Realizado por</div>
      </td>
      <td style="width:50%;padding:0 30px;text-align:center;vertical-align:bottom">
        ${bloqueFirma(firma, 'Autorizado por')}
      </td>
    </tr>
  </table>

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
