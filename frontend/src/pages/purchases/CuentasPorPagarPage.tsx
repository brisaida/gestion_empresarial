import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, AlertTriangle, CalendarClock, Banknote, FileText, Ban, Loader2, Truck, Receipt, History } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { cxpApi, comprasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import PagoProveedorModal, { type PagoDestino } from '@/components/credito/PagoProveedorModal'
import { METODO_COMPRA_LABEL } from '@/lib/metodosPago'
import EstadoPagoBadge from '@/components/credito/EstadoPagoBadge'
import { formatCurrency, formatDate, getAxiosError, cn } from '@/lib/utils'
import type { Compra, CuentaProveedor, PagoCompra } from '@/types'

type Tab = 'proveedores' | 'facturas' | 'pagos'
type Filtro = 'por_pagar' | 'vencida' | 'pendiente' | 'pagada'

export default function CuentasPorPagarPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc    = useQueryClient()
  const toast = useToast()

  const [tab, setTab]           = useState<Tab>('proveedores')
  const [search, setSearch]     = useState('')
  const [filtro, setFiltro]     = useState<Filtro>('por_pagar')
  const [pageFac, setPageFac]   = useState(1)
  const [pagePag, setPagePag]   = useState(1)
  const [desde, setDesde]       = useState('')
  const [hasta, setHasta]       = useState('')
  const [pago, setPago]         = useState<PagoDestino | null>(null)
  const [cuentaId, setCuentaId] = useState<number | null>(null)
  const [anularPago, setAnular] = useState<PagoCompra | null>(null)

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['cxp', 'resumen', empresaId, search],
    queryFn:  () => cxpApi.resumen({ empresa_id: empresaId, search: search || undefined }).then(r => r.data.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const { data: facturas, isLoading: loadingFac } = useQuery({
    queryKey: ['compras', 'credito', empresaId, filtro, pageFac, search],
    queryFn:  () => comprasApi.list({ empresa_id: empresaId, condicion: 'credito', estado_pago: filtro, page: pageFac, per_page: 15, search: search || undefined }).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'facturas',
    placeholderData: p => p,
  })

  const { data: pagos, isLoading: loadingPag } = useQuery({
    queryKey: ['cxp', 'pagos', empresaId, pagePag, desde, hasta],
    queryFn:  () => cxpApi.pagos({ empresa_id: empresaId, page: pagePag, per_page: 20, fecha_desde: desde || undefined, fecha_hasta: hasta || undefined }).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'pagos',
    placeholderData: p => p,
  })

  const { data: cuenta } = useQuery({
    queryKey: ['cxp', 'cuenta', cuentaId],
    queryFn:  () => cxpApi.estadoCuenta(cuentaId!).then(r => r.data.data),
    enabled:  cuentaId !== null,
  })

  const anular = useMutation({
    mutationFn: (id: number) => cxpApi.anular(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cxp'] })
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      toast.success('Pago anulado. El saldo volvió a la factura.')
      setAnular(null)
    },
    onError: (err) => toast.error(getAxiosError(err)),
  })

  const pagarFactura = (c: Compra) => setPago({
    compraId: c.id,
    titulo: `Factura ${c.numero_factura ?? `#${c.id}`}${c.proveedor ? ` · ${c.proveedor.nombre}` : ''}`,
    saldo: c.saldo_pendiente ?? 0,
    vence: c.fecha_vencimiento,
  })

  const t = resumen?.totales

  const colsProv: Column<CuentaProveedor & { id: number }>[] = [
    {
      key: 'nombre', header: 'Proveedor',
      cell: r => (
        <button onClick={() => setCuentaId(r.proveedor_id)} className="text-left group">
          <p className="font-semibold text-[var(--cs)] group-hover:text-[var(--cp)] transition-colors">{r.nombre}</p>
          <p className="text-xs text-[#5F6B7A]">{r.facturas} factura{r.facturas !== 1 ? 's' : ''}{r.vence_primero ? ` · vence ${formatDate(r.vence_primero)}` : ''}</p>
        </button>
      ),
    },
    { key: 'saldo',   header: 'Debes',  align: 'right', cell: r => <span className="font-bold text-[var(--cs)]">{formatCurrency(r.saldo)}</span> },
    { key: 'al_dia',  header: 'Al día', align: 'right', cell: r => <Monto v={r.al_dia} /> },
    { key: 'd1_30',   header: '1–30',   align: 'right', cell: r => <Monto v={r.d1_30} venc /> },
    { key: 'd31_60',  header: '31–60',  align: 'right', cell: r => <Monto v={r.d31_60} venc /> },
    { key: 'd61_90',  header: '61–90',  align: 'right', cell: r => <Monto v={r.d61_90} venc /> },
    { key: 'd90_mas', header: '+90',    align: 'right', cell: r => <Monto v={r.d90_mas} venc /> },
    {
      key: 'acciones', header: '', align: 'right', width: '180px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setCuentaId(r.proveedor_id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100">
            <FileText size={13} /> Detalle
          </button>
          <button onClick={() => r.proveedor_id && setPago({ proveedorId: r.proveedor_id, titulo: r.nombre, saldo: r.saldo })}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--cp)] hover:bg-[var(--cp)]/10">
            <Banknote size={13} /> Pagar
          </button>
        </div>
      ),
    },
  ]

  const colsFac: Column<Compra>[] = [
    { key: 'numero', header: 'Factura', width: '130px', cell: r => <span className="font-mono text-sm font-bold text-[var(--cp)]">{r.numero_factura ?? `#${r.id}`}</span> },
    { key: 'proveedor', header: 'Proveedor', cell: r => <span className="font-semibold text-[var(--cs)]">{r.proveedor?.nombre ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', align: 'center', cell: r => <span className="text-[#5F6B7A]">{formatDate(r.fecha_compra)}</span> },
    { key: 'vence', header: 'Vence', align: 'center', cell: r => <span className={r.estado_pago === 'vencida' ? 'text-red-600 font-semibold' : 'text-[#5F6B7A]'}>{formatDate(r.fecha_vencimiento)}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: r => <span className="text-[#5F6B7A]">{formatCurrency(r.total)}</span> },
    { key: 'saldo', header: 'Saldo', align: 'right', cell: r => <span className="font-bold text-[var(--cs)]">{formatCurrency(r.saldo_pendiente ?? 0)}</span> },
    { key: 'estado', header: 'Estado', align: 'center', width: '130px', cell: r => <EstadoPagoBadge venta={r} pendiente="Por pagar" /> },
    {
      key: 'acciones', header: '', align: 'right', width: '100px',
      cell: r => (r.saldo_pendiente ?? 0) > 0 && r.estado !== 'cancelada' ? (
        <button onClick={() => pagarFactura(r)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--cp)] hover:bg-[var(--cp)]/10 ml-auto">
          <Banknote size={13} /> Pagar
        </button>
      ) : null,
    },
  ]

  const colsPagos: Column<PagoCompra>[] = [
    { key: 'fecha', header: 'Fecha', width: '110px', cell: r => <span className="text-[#5F6B7A]">{formatDate(r.fecha)}</span> },
    { key: 'proveedor', header: 'Proveedor', cell: r => <span className="font-semibold text-[var(--cs)]">{r.proveedor ?? '—'}</span> },
    { key: 'factura', header: 'Factura', cell: r => <span className="font-mono text-xs text-[var(--cp)]">{r.numero_factura ?? `#${r.compra_id}`}</span> },
    {
      key: 'metodo', header: 'Forma de pago',
      cell: r => (
        <span className="text-[#5F6B7A]">
          {METODO_COMPRA_LABEL[r.metodo_pago] ?? r.metodo_pago}{r.desde_caja ? ' (caja)' : ''}{r.referencia ? ` · ${r.referencia}` : ''}
        </span>
      ),
    },
    { key: 'usuario', header: 'Registró', cell: r => <span className="text-xs text-[#5F6B7A]">{r.usuario ?? '—'}</span> },
    { key: 'monto', header: 'Monto', align: 'right', cell: r => <span className={r.anulado ? 'line-through text-gray-400' : 'font-bold text-[var(--cs)]'}>{formatCurrency(r.monto)}</span> },
    {
      key: 'acciones', header: '', align: 'right', width: '70px',
      cell: r => r.anulado
        ? <Badge variant="red">Anulado</Badge>
        : <button onClick={() => setAnular(r)} title="Anular pago" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Ban size={14} /></button>,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Cuentas por pagar</h1>
        <p className="text-sm text-[#5F6B7A]">Compras al crédito, lo que debes a cada proveedor y pagos realizados</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Wallet size={18} />} label="Debes en total" value={t?.saldo} sub={t ? `${t.facturas} facturas · ${t.proveedores} proveedores` : ''} tone="blue" />
        <Kpi icon={<CalendarClock size={18} />} label="Vence en 7 días" value={t?.vence_7_dias} sub="Programa estos pagos" tone="amber" />
        <Kpi icon={<AlertTriangle size={18} />} label="Vencido" value={t?.vencido} sub={t && t.saldo > 0 ? `${Math.round((t.vencido / t.saldo) * 100)}% del total` : ''} tone="red" />
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-2">Vencido por días</p>
          <div className="space-y-1 text-xs">
            {([['1–30', t?.d1_30], ['31–60', t?.d31_60], ['61–90', t?.d61_90], ['+90', t?.d90_mas]] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[#5F6B7A]">{l} días</span>
                <span className={cn('font-semibold', (v ?? 0) > 0 ? 'text-red-600' : 'text-gray-300')}>{formatCurrency(v ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-1 bg-[#F4F7FA] border border-gray-200 rounded-lg p-1 w-fit">
            {([
              { k: 'proveedores', l: 'Por proveedor', i: <Truck size={14} /> },
              { k: 'facturas',    l: 'Facturas',      i: <Receipt size={14} /> },
              { k: 'pagos',       l: 'Pagos',         i: <History size={14} /> },
            ] as const).map(x => (
              <button key={x.k} onClick={() => setTab(x.k)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all',
                  tab === x.k ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
                {x.i}{x.l}
              </button>
            ))}
          </div>
          {tab !== 'pagos' ? (
            <SearchBar value={search} onChange={v => { setSearch(v); setPageFac(1) }}
              placeholder={tab === 'proveedores' ? 'Buscar proveedor o RTN...' : 'Buscar factura o proveedor...'} className="md:max-w-xs w-full" />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPagePag(1) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
              <span className="text-[#5F6B7A]">a</span>
              <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPagePag(1) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
            </div>
          )}
        </div>

        {tab === 'proveedores' && (
          <Table columns={colsProv} loading={isLoading}
            data={(resumen?.proveedores ?? []).map(p => ({ ...p, id: p.proveedor_id ?? 0 }))}
            emptyMessage="No debes nada a proveedores. Las compras al crédito aparecerán aquí." />
        )}

        {tab === 'facturas' && (
          <>
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {([['por_pagar', 'Por pagar'], ['vencida', 'Vencidas'], ['pendiente', 'Al día'], ['pagada', 'Pagadas']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setFiltro(k); setPageFac(1) }}
                  className={cn('px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    filtro === k ? 'bg-[var(--cp)] text-white border-[var(--cp)]' : 'border-gray-200 text-[#5F6B7A] hover:border-[var(--cp)]')}>
                  {l}
                </button>
              ))}
            </div>
            <Table columns={colsFac} data={facturas?.data ?? []} loading={loadingFac} emptyMessage="No hay facturas en este filtro." />
            {facturas?.meta && <Pagination currentPage={facturas.meta.current_page} lastPage={facturas.meta.last_page} total={facturas.meta.total} onPage={setPageFac} />}
          </>
        )}

        {tab === 'pagos' && (
          <>
            <Table columns={colsPagos} data={pagos?.data ?? []} loading={loadingPag} emptyMessage="No hay pagos registrados." />
            {pagos?.meta && <Pagination currentPage={pagos.meta.current_page} lastPage={pagos.meta.last_page} total={pagos.meta.total} onPage={setPagePag} />}
          </>
        )}
      </div>

      {/* Detalle por proveedor */}
      <Modal open={cuentaId !== null} onClose={() => setCuentaId(null)} title="Cuenta con proveedor" size="xl">
        {!cuenta || cuenta.proveedor.id !== cuentaId ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[var(--cs)]">{cuenta.proveedor.nombre}</p>
                <p className="text-xs text-[#5F6B7A]">
                  {[cuenta.proveedor.rtn && `RTN ${cuenta.proveedor.rtn}`, cuenta.proveedor.telefono, `${cuenta.proveedor.dias_credito} días de crédito`].filter(Boolean).join(' · ')}
                </p>
              </div>
              {cuenta.resumen.saldo > 0 && (
                <Button icon={<Banknote size={14} />}
                  onClick={() => setPago({ proveedorId: cuenta.proveedor.id, titulo: cuenta.proveedor.nombre, saldo: cuenta.resumen.saldo })}>
                  Pago general
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {([['Debes', cuenta.resumen.saldo, false], ['Al día', cuenta.resumen.al_dia, false], ['1–30', cuenta.resumen.d1_30, true],
                 ['31–60', cuenta.resumen.d31_60, true], ['61–90', cuenta.resumen.d61_90, true], ['+90', cuenta.resumen.d90_mas, true]] as const).map(([l, v, venc]) => (
                <div key={l} className="px-3 py-2 rounded-lg bg-[#F4F7FA] border border-gray-100">
                  <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">{l}</p>
                  <p className={cn('text-sm font-bold', venc && v > 0 ? 'text-red-600' : 'text-[var(--cs)]')}>{formatCurrency(v)}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold text-[var(--cs)] uppercase tracking-wide mb-2">Facturas pendientes</p>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <Table columns={colsFac.filter(c => c.key !== 'proveedor')} data={cuenta.facturas} emptyMessage="No tienes facturas pendientes con este proveedor." />
              </div>
            </div>

            {cuenta.pagos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[var(--cs)] uppercase tracking-wide mb-2">Pagos</p>
                <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <Table columns={colsPagos.filter(c => c.key !== 'proveedor')} data={cuenta.pagos} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!anularPago} onClose={() => setAnular(null)} title="Anular pago" size="sm">
        {anularPago && (
          <>
            <p className="text-sm text-[#5F6B7A] mb-5">
              ¿Anular el pago de <strong>{formatCurrency(anularPago.monto)}</strong> a la factura {anularPago.numero_factura ?? `#${anularPago.compra_id}`}?
              El monto vuelve al saldo que le debes al proveedor{anularPago.desde_caja ? ' y deja de restarse en la caja' : ''}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnular(null)}>Volver</Button>
              <Button variant="danger" loading={anular.isPending} onClick={() => anular.mutate(anularPago.id)}>Anular pago</Button>
            </div>
          </>
        )}
      </Modal>

      <PagoProveedorModal destino={pago} onClose={() => setPago(null)} />
    </div>
  )
}

function Monto({ v, venc }: { v: number; venc?: boolean }) {
  if (v <= 0) return <span className="text-gray-300">—</span>
  return <span className={venc ? 'text-red-600 font-semibold' : 'text-[var(--cs)]'}>{formatCurrency(v)}</span>
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value?: number; sub?: string; tone: 'blue' | 'amber' | 'red' }) {
  const tones = { blue: 'bg-[var(--cp)]/10 text-[var(--cp)]', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide">{label}</p>
        <p className={cn('text-xl font-bold', tone === 'red' && (value ?? 0) > 0 ? 'text-red-600' : 'text-[var(--cs)]')}>{formatCurrency(value ?? 0)}</p>
        {sub && <p className="text-[11px] text-[#5F6B7A] truncate">{sub}</p>}
      </div>
    </div>
  )
}
