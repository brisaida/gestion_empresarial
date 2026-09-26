import { coloresDocumento, type PrintEmpresa } from './printVenta'

interface OpcionesExcel {
  hoja:    string
  archivo: string   // sin extensión
  titulo:  string
  empresa: PrintEmpresa
}

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase()

/**
 * Genera y descarga un .xlsx con los colores de la empresa:
 * nombre + título arriba, encabezado de columnas en color secundario
 * con línea en color primario, filas alternadas y filtros.
 * exceljs se importa dinámicamente para no cargarlo en el bundle principal.
 */
export async function exportarExcel(rows: Record<string, unknown>[], { hoja, archivo, titulo, empresa }: OpcionesExcel): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const { NAVY, BLUE } = coloresDocumento(empresa)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(hoja.slice(0, 31))
  const keys  = Object.keys(rows[0] ?? {})
  const nCols = Math.max(keys.length, 1)

  /* ── Encabezado del documento ─────────────────────────────── */
  const filaEmpresa = ws.addRow([empresa.nombre])
  filaEmpresa.font = { bold: true, size: 14, color: { argb: argb(NAVY) } }
  const filaTitulo = ws.addRow([titulo])
  filaTitulo.font = { bold: true, size: 11, color: { argb: argb(BLUE) } }
  const filaFecha = ws.addRow([`Generado: ${new Date().toLocaleString('es-HN')}`])
  filaFecha.font = { size: 9, color: { argb: 'FF888888' } }
  for (const r of [1, 2, 3]) ws.mergeCells(r, 1, r, nCols)
  ws.addRow([])

  /* ── Encabezado de columnas ───────────────────────────────── */
  const header = ws.addRow(keys)
  header.height = 20
  header.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(NAVY) } }
    cell.alignment = { vertical: 'middle' }
    cell.border    = { bottom: { style: 'medium', color: { argb: argb(BLUE) } } }
  })
  const headerRow = header.number

  /* ── Datos ────────────────────────────────────────────────── */
  rows.forEach((r, i) => {
    const row = ws.addRow(keys.map(k => r[k] ?? ''))
    row.eachCell({ includeEmpty: true }, cell => {
      if (typeof cell.value === 'number') {
        cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00'
      }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FA' } }
      }
    })
  })

  /* ── Anchos, filtros y encabezado fijo ────────────────────── */
  keys.forEach((k, i) => {
    const largo = rows.reduce((max, r) => Math.max(max, String(r[k] ?? '').length), k.length)
    ws.getColumn(i + 1).width = Math.min(Math.max(largo + 2, 12), 50)
  })
  if (keys.length) {
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: keys.length } }
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow }]

  /* ── Descargar ────────────────────────────────────────────── */
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${archivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
