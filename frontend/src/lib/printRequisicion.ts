import type { Requisicion, DatosFirma } from '@/types'
import { coloresDocumento, type PrintEmpresa } from './printVenta'
import { bloqueFirma } from './firmaDocumento'

// Descripciones, códigos y nombres se escriben a mano: escaparlos
const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmtCant = (n: number) => Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2)
const fmtNum  = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const fmtFecha = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}` }

/** Celda de dinero con "L" alineada a la izquierda y el monto a la derecha, como en el formato en papel. */
const dinero = (n: number, bold = false) =>
  `<span style="float:left">L</span><span style="${bold ? 'font-weight:800' : ''}">${fmtNum(n)}</span>`

export async function printRequisicion(r: Requisicion, empresa: PrintEmpresa, logoSrc?: string, firma?: DatosFirma | null): Promise<void> {
  const { NAVY, BLUE } = coloresDocumento(empresa)
  const detalles = r.detalles ?? []
  const B = '1px solid #333' // bordes del formato

  const condicion = r.condicion === 'credito' ? 'CRÉDITO' : r.condicion === 'contado' ? 'CONTADO' : '—'

  /* ── Filas de artículos ─────────────────────────────────── */
  const filas = detalles.map(d => `
    <tr>
      <td style="border:${B};padding:3px 8px;text-align:center">${fmtCant(d.cantidad)}</td>
      <td style="border:${B};padding:3px 8px;text-align:center">${d.codigo ? escapeHtml(d.codigo) : '—'}</td>
      <td style="border:${B};padding:3px 8px;text-align:center">${escapeHtml(d.descripcion ?? '')}</td>
      <td style="border:${B};padding:3px 8px;text-align:right">${dinero(d.precio_unitario)}</td>
      <td style="border:${B};padding:3px 8px;text-align:right">${dinero(d.subtotal)}</td>
    </tr>`).join('')

  /* ── Logo o inicial ─────────────────────────────────────── */
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="max-height:130px;max-width:300px;object-fit:contain" alt="Logo">`
    : `<div style="font-size:30px;font-weight:900;color:${NAVY}">${escapeHtml(empresa.nombre)}</div>`

  const prov = r.proveedor
  const lineaProveedor = prov
    ? `<tr><td style="border:${B};padding:3px 6px;font-weight:700">Proveedor: ${escapeHtml(prov.nombre)}</td></tr>` : ''

  const obsBlock = r.observaciones ? `
    <div style="margin-top:10px;font-size:11px;color:#333"><strong>Observaciones:</strong> ${escapeHtml(r.observaciones)}</div>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${r.numero_requisicion} — Requisición</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Calibri, Carlito, Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 12px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: letter; margin: 14mm 12mm; }
      .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
    }
    .page { max-width: 780px; margin: 0 auto; padding: 24px 20px; }
    table { border-collapse: collapse; }
    .caja { border: 2px solid #333; }
  </style>
</head>
<body>
<div class="page">

  <div class="no-print" style="text-align:right;margin-bottom:14px">
    <button onclick="window.print()" style="background:${BLUE};color:#fff;border:none;padding:9px 22px;border-radius:7px;font-size:13px;cursor:pointer;font-weight:600">
      🖨️ Guardar / Imprimir PDF
    </button>
  </div>

  <div class="caja">
    <!-- ═══ ENCABEZADO ═══ -->
    <div style="border-bottom:${B};text-align:center;font-weight:800;font-size:13px;padding:2px;color:${NAVY}">${escapeHtml(empresa.nombre.toUpperCase())}</div>
    ${empresa.direccion ? `<div style="border-bottom:${B};text-align:center;font-weight:700;font-size:13px;padding:2px">Dirección: ${escapeHtml(empresa.direccion)}</div>` : ''}
    ${empresa.telefono  ? `<div style="border-bottom:${B};text-align:center;font-weight:700;font-size:12px;padding:2px">TEL. ${escapeHtml(empresa.telefono)}</div>` : ''}

    <table style="width:100%">
      <tr>
        <td style="width:68%;height:150px;text-align:center;vertical-align:middle;padding:10px">${logoHtml}</td>
        <td style="vertical-align:top;padding:0">
          <div style="text-align:center;font-size:20px;font-weight:800;color:${BLUE};padding:14px 0 10px;border-bottom:${B}">REQUISICIÓN</div>
          <div style="height:62px"></div>
          <table style="width:100%">
            <tr>
              <td style="border:${B};border-left:${B};padding:3px 6px;font-weight:800;color:${BLUE};text-align:center">CONDICIÓN</td>
              <td style="border:${B};border-right:none;padding:3px 6px;font-weight:800;color:${BLUE}">${condicion}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ═══ FACTURAR A ═══ -->
    <table style="width:44%;margin-top:4px;font-size:13px">
      <tr><td style="border:${B};border-left:none;padding:3px 6px;font-weight:700">Facturar a: ${escapeHtml(empresa.nombre.toUpperCase())}</td></tr>
      <tr><td style="border:${B};border-left:none;padding:3px 6px;font-weight:700">RTN: ${empresa.rtn ? escapeHtml(empresa.rtn) : '—'}</td></tr>
      ${lineaProveedor.replace(`border:${B};`, `border:${B};border-left:none;`)}
    </table>

    <!-- ═══ PEDIDO ═══ -->
    <table style="width:66%;margin-top:22px;font-size:12px">
      <tr style="font-weight:700">
        <td style="border:${B};border-left:none;padding:3px 6px;width:33%">N. DE PEDIDO ${escapeHtml(r.numero_requisicion)}</td>
        <td style="border:${B};padding:3px 6px;width:33%">ELABORADO POR</td>
        <td style="border:${B};padding:3px 6px">FECHA DE ENVÍO</td>
      </tr>
      <tr>
        <td style="border:${B};border-left:none;padding:3px 6px"></td>
        <td style="border:${B};padding:3px 6px;font-weight:700">${r.realizado_por ? escapeHtml(r.realizado_por.toUpperCase()) : '—'}</td>
        <td style="border:${B};padding:3px 6px;font-weight:700">${fmtFecha(r.fecha_requisicion)}</td>
      </tr>
    </table>

    <!-- ═══ DETALLE ═══ -->
    <table style="width:100%;margin-top:14px;font-size:12px">
      <thead>
        <tr style="background:${NAVY};color:#fff;font-weight:700">
          <td style="border:${B};border-left:none;padding:6px 8px;width:14%">CANTIDAD</td>
          <td style="border:${B};padding:6px 8px;width:17%;text-align:center">CÓDIGO</td>
          <td style="border:${B};padding:6px 8px;text-align:center">DESCRIPCIÓN</td>
          <td style="border:${B};padding:6px 8px;width:18%">PRECIO POR UNIDAD</td>
          <td style="border:${B};border-right:none;padding:6px 8px;width:16%;text-align:center">TOTAL</td>
        </tr>
      </thead>
      <tbody>
        ${filas || `<tr><td colspan="5" style="border:${B};padding:10px;text-align:center;color:#999">Sin artículos</td></tr>`}
        <tr><td colspan="3" style="border-right:${B}"></td><td style="border:${B};padding:3px 8px;height:18px"></td><td style="border:${B};border-right:none"></td></tr>
        <tr>
          <td colspan="3" style="border-right:${B}"></td>
          <td style="border:${B};padding:3px 8px">SUB-TOTAL</td>
          <td style="border:${B};border-right:none;padding:3px 8px;text-align:right">${dinero(r.subtotal)}</td>
        </tr>
        <tr>
          <td colspan="3" style="border-right:${B}"></td>
          <td style="border:${B};padding:3px 8px">ISV</td>
          <td style="border:${B};border-right:none;padding:3px 8px;text-align:right">${dinero(r.impuesto)}</td>
        </tr>
        <tr style="font-weight:800">
          <td colspan="3" style="border-right:${B}"></td>
          <td style="border:${B};border-bottom:none;padding:3px 8px;color:${NAVY}">TOTAL</td>
          <td style="border:${B};border-right:none;border-bottom:none;padding:3px 8px;text-align:right;color:${NAVY}">${dinero(r.total, true)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${obsBlock}

  <!-- ═══ FIRMAS ═══ -->
  <table style="width:100%;margin-top:30px;font-size:11.5px">
    <tr>
      <td style="width:50%;padding:0 30px;text-align:center;vertical-align:bottom">
        <div style="height:70px"></div>
        <div style="font-weight:700">ELABORADO POR: ${r.realizado_por ? escapeHtml(r.realizado_por.toUpperCase()) : '________________'}</div>
      </td>
      <td style="width:50%;padding:0 30px;text-align:center;vertical-align:bottom">
        ${bloqueFirma(firma, 'AUTORIZADO POR')}
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
