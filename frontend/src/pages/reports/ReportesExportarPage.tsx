import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '@/stores/authStore'
import { dashboardApi, ventasApi, comprasApi, reportesApi } from '@/api/recursos'
import { formatCurrency } from '@/lib/utils'
import { Download, Loader2, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import type { Venta, Compra } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────

const localISO = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const hoy = () => localISO()
const inicioMes = () => {
  const d = new Date()
  return localISO(new Date(d.getFullYear(), d.getMonth(), 1))
}
const subDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localISO(d)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function writeXlsx(rows: object[], sheetName: string, filename: string) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  // Auto column widths
  const keys = Object.keys(rows[0] ?? {})
  ws['!cols'] = keys.map(k => ({ wch: Math.max(k.length + 2, 14) }))
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ── DateRange input component ─────────────────────────────────────────────

interface DateRange { desde: string; hasta: string }

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Desde</span>
        <input
          type="date"
          value={value.desde}
          onChange={e => onChange({ ...value, desde: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Hasta</span>
        <input
          type="date"
          value={value.hasta}
          onChange={e => onChange({ ...value, hasta: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30"
        />
      </div>
    </div>
  )
}

// ── Export card ───────────────────────────────────────────────────────────

interface CardProps {
  id: string
  title: string
  description: string
  loading: Record<string, boolean>
  done: Record<string, boolean>
  onExport: (id: string) => void
  children?: React.ReactNode
}

function ExportCard({ id, title, description, loading, done, onExport, children }: CardProps) {
  const isLoading = loading[id]
  const isDone    = done[id]
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={18} className="text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-[#072B5A] text-sm leading-tight">{title}</p>
          <p className="text-xs text-[#5F6B7A] mt-0.5">{description}</p>
        </div>
      </div>

      {children}

      <button
        onClick={() => onExport(id)}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
          isDone
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : isLoading
              ? 'bg-gray-100 text-[#5F6B7A] cursor-not-allowed'
              : 'bg-[#0E78D8] text-white hover:bg-[#0B69C2] shadow-sm'
        }`}
      >
        {isLoading ? (
          <><Loader2 size={15} className="animate-spin" /> Generando...</>
        ) : isDone ? (
          <><CheckCircle2 size={15} /> Descargado</>
        ) : (
          <><Download size={15} /> Exportar Excel</>
        )}
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ReportesExportarPage() {
  const { state } = useAuth()
  const empresaId  = state.empresaActiva?.id ?? 0
  const nombreEmp  = state.empresaActiva?.nombre ?? 'Empresa'

  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [done,    setDone]    = useState<Record<string, boolean>>({})
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  const [rangeVentas,    setRangeVentas]    = useState<DateRange>({ desde: inicioMes(), hasta: hoy() })
  const [rangeCompras,   setRangeCompras]   = useState<DateRange>({ desde: inicioMes(), hasta: hoy() })
  const [rangeIngresos,  setRangeIngresos]  = useState<DateRange>({ desde: subDays(29), hasta: hoy() })
  const [rangeProductos, setRangeProductos] = useState<DateRange>({ desde: subDays(29), hasta: hoy() })
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana' | 'mes'>('dia')

  function startLoad(id: string) {
    setLoading(p => ({ ...p, [id]: true }))
    setDone(p => ({ ...p, [id]: false }))
    setErrors(p => ({ ...p, [id]: '' }))
  }
  function endLoad(id: string, ok: boolean, err?: string) {
    setLoading(p => ({ ...p, [id]: false }))
    if (ok) setDone(p => ({ ...p, [id]: true }))
    if (err) setErrors(p => ({ ...p, [id]: err }))
    if (ok) setTimeout(() => setDone(p => ({ ...p, [id]: false })), 3000)
  }

  const handlers: Record<string, () => Promise<void>> = {

    async kpis() {
      const res = await dashboardApi.get(empresaId)
      const r = res.data.data.resumen
      const rows = [
        { 'KPI': 'Ventas del mes',             'Valor': r.ventas_mes },
        { 'KPI': 'Ventas mes anterior',         'Valor': r.ventas_mes_anterior },
        { 'KPI': 'Variación vs mes anterior (%)', 'Valor': r.variacion_ventas_pct ?? '—' },
        { 'KPI': 'Margen bruto del mes',        'Valor': r.margen_bruto_mes },
        { 'KPI': 'Margen bruto (%)',            'Valor': r.margen_pct },
        { 'KPI': 'Valor del inventario',        'Valor': r.valor_inventario },
        { 'KPI': 'Compras del mes',             'Valor': r.compras_mes },
        { 'KPI': 'Compras pendientes (cantidad)', 'Valor': r.compras_pendientes_count },
        { 'KPI': 'Compras pendientes (monto)',  'Valor': r.compras_pendientes_monto },
        { 'KPI': 'Productos activos',           'Valor': r.total_productos },
        { 'KPI': 'Proveedores activos',         'Valor': r.total_proveedores },
        { 'KPI': 'Productos con stock bajo',    'Valor': r.productos_stock_bajo },
      ]
      writeXlsx(rows, 'KPIs', `KPIs_${nombreEmp}_${hoy()}`)
    },

    async ventas() {
      const res = await ventasApi.list({
        empresa_id:  empresaId,
        fecha_desde: rangeVentas.desde,
        fecha_hasta: rangeVentas.hasta,
        estado:      'completada',
        per_page:    5000,
      })
      const ventas = res.data.data as unknown as Venta[]
      const rows = ventas.map(v => ({
        'N° Factura':  v.numero_factura ?? '',
        'Cliente':     v.cliente?.nombre ?? 'Consumidor final',
        'Bodega':      v.bodega?.nombre ?? '',
        'Fecha':       fmtDate(typeof v.fecha_venta === 'string' ? v.fecha_venta.slice(0, 10) : ''),
        'Subtotal (L)': v.subtotal,
        'Descuento (L)': v.descuento,
        'ISV (L)':     v.impuesto,
        'Total (L)':   v.total,
        'Estado':      v.estado,
      }))
      writeXlsx(rows, 'Ventas', `Ventas_${rangeVentas.desde}_${rangeVentas.hasta}`)
    },

    async compras() {
      const res = await comprasApi.list({
        empresa_id:  empresaId,
        fecha_desde: rangeCompras.desde,
        fecha_hasta: rangeCompras.hasta,
        per_page:    5000,
      })
      const compras = res.data.data as unknown as Compra[]
      const rows = compras.map(c => ({
        'N° Factura':    c.numero_factura ?? '',
        'Proveedor':     c.proveedor?.nombre ?? '',
        'Bodega':        c.bodega?.nombre ?? '',
        'Fecha':         fmtDate(typeof c.fecha_compra === 'string' ? c.fecha_compra.slice(0, 10) : ''),
        'Subtotal (L)':  c.subtotal,
        'Descuento (L)': c.descuento,
        'ISV (L)':       c.impuesto,
        'Total (L)':     c.total,
        'Estado':        c.estado,
      }))
      writeXlsx(rows, 'Compras', `Compras_${rangeCompras.desde}_${rangeCompras.hasta}`)
    },

    async ingresos() {
      const res = await reportesApi.ingresos({
        empresa_id:  empresaId,
        fecha_desde: rangeIngresos.desde,
        fecha_hasta: rangeIngresos.hasta,
        agrupacion,
      })
      const { filas, resumen } = (res.data as { data: { filas: { periodo: string; total: number; cantidad: number }[]; resumen: { total: number; cantidad: number; promedio: number } } }).data
      const rows = filas.map(f => ({
        'Período':       f.periodo,
        'N° ventas':     f.cantidad,
        'Total (L)':     f.total,
      }))
      rows.push({ 'Período': 'TOTAL', 'N° ventas': resumen.cantidad, 'Total (L)': resumen.total })
      writeXlsx(rows, 'Ingresos', `Ingresos_${rangeIngresos.desde}_${rangeIngresos.hasta}`)
    },

    async productos() {
      const res = await reportesApi.topProductos({
        empresa_id:  empresaId,
        fecha_desde: rangeProductos.desde,
        fecha_hasta: rangeProductos.hasta,
        limit:       200,
      })
      const items = (res.data as { data: { producto_id: number; nombre: string; codigo?: string; total_unidades: number; total_monto: number }[] }).data
      const rows = items.map((r, i) => ({
        '#':              i + 1,
        'Producto':       r.nombre,
        'Código':         r.codigo ?? '',
        'Unidades vendidas': r.total_unidades,
        'Ingreso total (L)': r.total_monto,
      }))
      writeXlsx(rows, 'Top Productos', `TopProductos_${rangeProductos.desde}_${rangeProductos.hasta}`)
    },

    async inventario() {
      const res = await reportesApi.inventario({ empresa_id: empresaId })
      const items = (res.data as { data: { nombre: string; codigo?: string; categoria: string; costo: number; stock_total: number; valor_total: number }[] }).data
      const rows = items.map(r => ({
        'Producto':          r.nombre,
        'Código':            r.codigo ?? '',
        'Categoría':         r.categoria,
        'Stock actual':      r.stock_total,
        'Costo unitario (L)': r.costo,
        'Valor total (L)':   r.valor_total,
      }))
      writeXlsx(rows, 'Inventario', `Inventario_${hoy()}`)
    },
  }

  async function doExport(id: string) {
    startLoad(id)
    try {
      await handlers[id]()
      endLoad(id, true)
    } catch {
      endLoad(id, false, 'Error al generar el archivo.')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Exportar a Excel</h1>
        <p className="text-sm text-[#5F6B7A]">Descarga los datos de tu empresa en formato .xlsx</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* KPIs del mes */}
        <ExportCard
          id="kpis"
          title="KPIs del mes actual"
          description="Resumen de indicadores clave: ventas, margen, inventario, compras pendientes y más."
          loading={loading} done={done} onExport={doExport}
        />

        {/* Inventario actual */}
        <ExportCard
          id="inventario"
          title="Inventario actual"
          description="Stock actual por producto con costo unitario y valor total del inventario."
          loading={loading} done={done} onExport={doExport}
        />

        {/* Ventas del período */}
        <ExportCard
          id="ventas"
          title="Ventas por período"
          description="Historial de ventas completadas con cliente, fecha, subtotal, ISV y total."
          loading={loading} done={done} onExport={doExport}
        >
          <DateRangePicker value={rangeVentas} onChange={setRangeVentas} />
        </ExportCard>

        {/* Compras del período */}
        <ExportCard
          id="compras"
          title="Compras por período"
          description="Historial de órdenes de compra con proveedor, fecha y montos."
          loading={loading} done={done} onExport={doExport}
        >
          <DateRangePicker value={rangeCompras} onChange={setRangeCompras} />
        </ExportCard>

        {/* Ingresos resumidos */}
        <ExportCard
          id="ingresos"
          title="Ingresos agrupados"
          description="Ventas totalizadas por día, semana o mes. Ideal para análisis de tendencias."
          loading={loading} done={done} onExport={doExport}
        >
          <div className="space-y-2">
            <DateRangePicker value={rangeIngresos} onChange={setRangeIngresos} />
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1 w-fit">
              {(['dia', 'semana', 'mes'] as const).map(ag => (
                <button key={ag} onClick={() => setAgrupacion(ag)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors capitalize ${
                    agrupacion === ag
                      ? 'bg-[#0E78D8] text-white shadow-sm'
                      : 'text-[#5F6B7A] hover:bg-white'
                  }`}>
                  {ag === 'dia' ? 'Por día' : ag === 'semana' ? 'Por semana' : 'Por mes'}
                </button>
              ))}
            </div>
          </div>
        </ExportCard>

        {/* Top productos */}
        <ExportCard
          id="productos"
          title="Productos más vendidos"
          description="Ranking de hasta 200 productos por ingreso total en el período."
          loading={loading} done={done} onExport={doExport}
        >
          <DateRangePicker value={rangeProductos} onChange={setRangeProductos} />
        </ExportCard>

      </div>

      {/* Error messages */}
      {Object.entries(errors).some(([, v]) => v) && (
        <div className="space-y-1">
          {Object.entries(errors).filter(([, v]) => v).map(([k, msg]) => (
            <p key={k} className="text-sm text-red-600">Error en {k}: {msg}</p>
          ))}
        </div>
      )}

      {/* Quick tip */}
      <div className="bg-[#F4F7FA] rounded-xl border border-gray-200 p-4 text-sm text-[#5F6B7A]">
        <span className="font-semibold text-[#072B5A]">Tip:</span> Los archivos se generan directamente en tu navegador — no se almacenan en el servidor.
        Los montos están en Lempiras (L). Para ver el archivo generado revisa tu carpeta de descargas.
      </div>
    </div>
  )
}
