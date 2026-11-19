import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, AlertTriangle, CheckCircle2, HandCoins, FileText, Printer, Ban, Loader2, Users, Receipt, History } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { cxcApi, ventasApi, empresaApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import AbonoModal, { type AbonoDestino } from '@/components/credito/AbonoModal'
import EstadoPagoBadge from '@/components/credito/EstadoPagoBadge'
import { printEstadoCuenta, printReciboAbono } from '@/lib/printCredito'
import { formatoNumeroFactura } from '@/lib/printVenta'
import { formatCurrency, formatDate, getAxiosError, todayISO, cn } from '@/lib/utils'
import type { AbonoVenta, CuentaCliente, Venta } from '@/types'

type Tab = 'clientes' | 'facturas' | 'abonos'
type FiltroFacturas = 'por_cobrar' | 'vencida' | 'pendiente' | 'pagada'

const METODO: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cheque: 'Cheque' }

export default function CuentasPorCobrarPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc    = useQueryClient()
  const toast = useToast()

  const [tab, setTab]               = useState<Tab>('clientes')
  const [search, setSearch]         = useState('')
  const [filtro, setFiltro]         = useState<FiltroFacturas>('por_cobrar')
  const [pageFac, setPageFac]       = useState(1)
  const [pageAbo, setPageAbo]       = useState(1)
  const [desde, setDesde]           = useState('')
  const [hasta, setHasta]           = useState('')
  const [abono, setAbono]           = useState<AbonoDestino | null>(null)
  const [cuentaId, setCuentaId]     = useState<number | null>(null)
  const [anularAbono, setAnular]    = useState<AbonoVenta | null>(null)

  /* ── Datos ─────────────────────────────────────────────────────── */
  const { data: resumen, isLoading } = useQuery({
    queryKey: ['cxc', 'resumen', empresaId, search],
    queryFn:  () => cxcApi.resumen({ empresa_id: empresaId, search: search || undefined }).then(r => r.data.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const { data: facturas, isLoading: loadingFac } = useQuery({
    queryKey: ['ventas', 'credito', empresaId, filtro, pageFac, search],
    queryFn:  () => ventasApi.list({ empresa_id: empresaId, condicion: 'credito', estado_pago: filtro, page: pageFac, per_page: 15, search: search || undefined }).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'facturas',
    placeholderData: p => p,
  })

  const { data: abonos, isLoading: loadingAbo } = useQuery({
    queryKey: ['cxc', 'abonos', empresaId, pageAbo, desde, hasta],
    queryFn:  () => cxcApi.abonos({ empresa_id: empresaId, page: pageAbo, per_page: 20, fecha_desde: desde || undefined, fecha_hasta: hasta || undefined }).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'abonos',
    placeholderData: p => p,
  })

  const { data: cuenta, isFetching: loadingCuenta } = useQuery({
    queryKey: ['cxc', 'cuenta', cuentaId],
    queryFn:  () => cxcApi.estadoCuenta(cuentaId!).then(r => r.data.data),
    enabled:  cuentaId !== null,
  })

  const anular = useMutation({
    mutationFn: (id: number) => cxcApi.anular(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cxc'] })
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['clientes-all'] })
      toast.success('Abono anulado. El saldo volvió a la factura.')
      setAnular(null)
    },
    onError: (err) => toast.error(getAxiosError(err)),
  })

  const empresaDocs = async () => {
    const [emp, logo] = await Promise.all([empresaApi.get(empresaId), empresaApi.logoBase64(empresaId)])
    return { emp: emp.data.data, logo: logo.data.data.logo_base64 ?? undefined }
  }

  const imprimirCuenta = async () => {
    if (!cuenta) return
    try { const { emp, logo } = await empresaDocs(); printEstadoCuenta(cuenta, emp, logo, todayISO()) }
    catch { toast.error('No se pudo generar el estado de cuenta.') }
  }

  const reimprimir = async (a: AbonoVenta) => {
    try { const { emp, logo } = await empresaDocs(); printReciboAbono([a], emp, logo) }
    catch { toast.error('No se pudo generar el recibo.') }
  }

  const abonarFactura = (v: Venta) => setAbono({
    ventaId: v.id,
    titulo: `Factura ${formatoNumeroFactura(v.numero_factura)}${v.cliente ? ` · ${v.cliente.nombre}` : ''}`,
    saldo: v.saldo_pendiente ?? 0,
    vence: v.fecha_vencimiento,
  })

  const t = resumen?.totales

  /* ── Columnas ──────────────────────────────────────────────────── */
  const colsClientes: Column<CuentaCliente & { id: number }>[] = [
    {
      key: 'nombre', header: 'Cliente',
      cell: r => (
        <button onClick={() => setCuentaId(r.cliente_id)} className="text-left group">
          <p className="font-semibold text-[var(--cs)] group-hover:text-[var(--cp)] transition-colors">{r.nombre}</p>
          <p className="text-xs text-[#5F6B7A]">{r.facturas} factura{r.facturas !== 1 ? 's' : ''}{r.telefono ? ` · ${r.telefono}` : ''}</p>
        </button>
      ),
    },
    { key: 'saldo',   header: 'Saldo',   align: 'right', cell: r => <span className="font-bold text-[var(--cs)]">{formatCurrency(r.saldo)}</span> },
    { key: 'al_dia',  header: 'Al día',  align: 'right', cell: r => <Monto v={r.al_dia} /> },
    { key: 'd1_30',   header: '1–30',    align: 'right', cell: r => <Monto v={r.d1_30} venc /> },
    { key: 'd31_60',  header: '31–60',   align: 'right', cell: r => <Monto v={r.d31_60} venc /> },
    { key: 'd61_90',  header: '61–90',   align: 'right', cell: r => <Monto v={r.d61_90} venc /> },
    { key: 'd90_mas', header: '+90',     align: 'right', cell: r => <Monto v={r.d90_mas} venc /> },
    {
      key: 'limite', header: 'Límite', align: 'right',
      cell: r => r.limite_credito == null
        ? <span className="text-xs text-gray-400">Sin límite</span>
        : <span className={cn('text-xs', r.saldo > r.limite_credito ? 'text-red-600 font-semibold' : 'text-[#5F6B7A]')}>{formatCurrency(r.limite_credito)}</span>,
    },
    {
      key: 'acciones', header: '', align: 'right', width: '190px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setCuentaId(r.cliente_id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100">
            <FileText size={13} /> Cuenta
          </button>
          <button onClick={() => r.cliente_id && setAbono({ clienteId: r.cliente_id, titulo: r.nombre, saldo: r.saldo })}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--cp)] hover:bg-[var(--cp)]/10">
            <HandCoins size={13} /> Abonar
          </button>
        </div>
      ),
    },
  ]

  const colsFacturas: Column<Venta>[] = [
    { key: 'numero', header: 'Factura', width: '170px', cell: r => <span className="font-mono text-sm font-bold text-[var(--cp)]">{formatoNumeroFactura(r.numero_factura)}</span> },
    { key: 'cliente', header: 'Cliente', cell: r => <span className="font-semibold text-[var(--cs)]">{r.cliente?.nombre ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', align: 'center', cell: r => <span className="text-[#5F6B7A]">{formatDate(r.fecha_venta)}</span> },
    { key: 'vence', header: 'Vence', align: 'center', cell: r => <span className={r.estado_pago === 'vencida' ? 'text-red-600 font-semibold' : 'text-[#5F6B7A]'}>{formatDate(r.fecha_vencimiento)}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: r => <span className="text-[#5F6B7A]">{formatCurrency(r.total)}</span> },
    { key: 'saldo', header: 'Saldo', align: 'right', cell: r => <span className="font-bold text-[var(--cs)]">{formatCurrency(r.saldo_pendiente ?? 0)}</span> },
    { key: 'estado', header: 'Estado', align: 'center', width: '130px', cell: r => <EstadoPagoBadge venta={r} /> },
    {
      key: 'acciones', header: '', align: 'right', width: '100px',
      cell: r => (r.saldo_pendiente ?? 0) > 0 && r.estado !== 'cancelada' ? (
        <button onClick={() => abonarFactura(r)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--cp)] hover:bg-[var(--cp)]/10 ml-auto">
          <HandCoins size={13} /> Abonar
        </button>
      ) : null,
    },
  ]

  const colsAbonos: Column<AbonoVenta>[] = [
    { key: 'fecha', header: 'Fecha', width: '110px', cell: r => <span className="text-[#5F6B7A]">{formatDate(r.fecha)}</span> },
    { key: 'recibo', header: 'Recibo', width: '110px', cell: r => <span className="font-mono text-xs text-[#5F6B7A]">REC-{String(r.id).padStart(6, '0')}</span> },
    { key: 'cliente', header: 'Cliente', cell: r => <span className="font-semibold text-[var(--cs)]">{r.cliente ?? '—'}</span> },
    { key: 'factura', header: 'Factura', cell: r => <span className="font-mono text-xs text-[var(--cp)]">{formatoNumeroFactura(r.numero_factura)}</span> },
    { key: 'metodo', header: 'Forma de pago', cell: r => <span className="text-[#5F6B7A]">{METODO[r.metodo_pago] ?? r.metodo_pago}{r.referencia ? ` · ${r.referencia}` : ''}</span> },
    { key: 'usuario', header: 'Recibió', cell: r => <span className="text-xs text-[#5F6B7A]">{r.usuario ?? '—'}</span> },
    {
      key: 'monto', header: 'Monto', align: 'right',
      cell: r => <span className={r.anulado ? 'line-through text-gray-400' : 'font-bold text-emerald-600'}>{formatCurrency(r.monto)}</span>,
    },
    {
      key: 'acciones', header: '', align: 'right', width: '90px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          {r.anulado
            ? <Badge variant="red">Anulado</Badge>
            : <>
                <button onClick={() => reimprimir(r)} title="Imprimir recibo" className="p-1.5 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100"><Printer size={14} /></button>
                <button onClick={() => setAnular(r)} title="Anular abono" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Ban size={14} /></button>
              </>}
        </div>
      ),
    },
  ]

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Cuentas por cobrar</h1>
        <p className="text-sm text-[#5F6B7A]">Ventas al crédito, saldos por cliente y abonos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Wallet size={18} />} label="Por cobrar" value={t?.saldo} sub={t ? `${t.facturas} facturas · ${t.clientes} clientes` : ''} tone="blue" />
        <Kpi icon={<CheckCircle2 size={18} />} label="Al día" value={t?.al_dia} sub="Aún no vencen" tone="green" />
        <Kpi icon={<AlertTriangle size={18} />} label="Vencido" value={t?.vencido}
          sub={t && t.saldo > 0 ? `${Math.round((t.vencido / t.saldo) * 100)}% del total` : ''} tone="red" />
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
              { k: 'clientes', l: 'Por cliente', i: <Users size={14} /> },
              { k: 'facturas', l: 'Facturas',    i: <Receipt size={14} /> },
              { k: 'abonos',   l: 'Abonos',      i: <History size={14} /> },
            ] as const).map(x => (
              <button key={x.k} onClick={() => setTab(x.k)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all',
                  tab === x.k ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
                {x.i}{x.l}
              </button>
            ))}
          </div>
          {tab !== 'abonos' ? (
            <SearchBar value={search} onChange={v => { setSearch(v); setPageFac(1) }}
              placeholder={tab === 'clientes' ? 'Buscar cliente o RTN...' : 'Buscar factura o cliente...'} className="md:max-w-xs w-full" />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPageAbo(1) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
              <span className="text-[#5F6B7A]">a</span>
              <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPageAbo(1) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
            </div>
          )}
        </div>

        {tab === 'clientes' && (
          <Table columns={colsClientes} loading={isLoading}
            data={(resumen?.clientes ?? []).map(c => ({ ...c, id: c.cliente_id ?? 0 }))}
            emptyMessage="No hay saldos pendientes. Las ventas al crédito aparecerán aquí." />
        )}

        {tab === 'facturas' && (
          <>
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {([['por_cobrar', 'Por cobrar'], ['vencida', 'Vencidas'], ['pendiente', 'Al día'], ['pagada', 'Pagadas']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setFiltro(k); setPageFac(1) }}
                  className={cn('px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    filtro === k ? 'bg-[var(--cp)] text-white border-[var(--cp)]' : 'border-gray-200 text-[#5F6B7A] hover:border-[var(--cp)]')}>
                  {l}
                </button>
              ))}
            </div>
            <Table columns={colsFacturas} data={facturas?.data ?? []} loading={loadingFac} emptyMessage="No hay facturas en este filtro." />
            {facturas?.meta && <Pagination currentPage={facturas.meta.current_page} lastPage={facturas.meta.last_page} total={facturas.meta.total} onPage={setPageFac} />}
          </>
        )}

        {tab === 'abonos' && (
          <>
            <Table columns={colsAbonos} data={abonos?.data ?? []} loading={loadingAbo} emptyMessage="No hay abonos registrados." />
            {abonos?.meta && <Pagination currentPage={abonos.meta.current_page} lastPage={abonos.meta.last_page} total={abonos.meta.total} onPage={setPageAbo} />}
          </>
        )}
      </div>

      {/* Estado de cuenta */}
      <Modal open={cuentaId !== null} onClose={() => setCuentaId(null)} title="Estado de cuenta" size="xl">
        {!cuenta || loadingCuenta && cuenta.cliente.id !== cuentaId ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[var(--cs)]">{cuenta.cliente.nombre}</p>
                <p className="text-xs text-[#5F6B7A]">
                  {[cuenta.cliente.rtn && `RTN ${cuenta.cliente.rtn}`, cuenta.cliente.telefono, `${cuenta.cliente.dias_credito} días de crédito`,
                    cuenta.cliente.limite_credito != null ? `Límite ${formatCurrency(cuenta.cliente.limite_credito)}` : 'Sin límite'].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" icon={<Printer size={14} />} onClick={imprimirCuenta}>Imprimir</Button>
                {cuenta.resumen.saldo > 0 && (
                  <Button icon={<HandCoins size={14} />}
                    onClick={() => setAbono({ clienteId: cuenta.cliente.id, titulo: cuenta.cliente.nombre, saldo: cuenta.resumen.saldo })}>
                    Abono general
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {([['Saldo', cuenta.resumen.saldo, false], ['Al día', cuenta.resumen.al_dia, false], ['1–30', cuenta.resumen.d1_30, true],
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
                <Table columns={colsFacturas.filter(c => c.key !== 'cliente')} data={cuenta.facturas} emptyMessage="No tiene facturas pendientes." />
              </div>
            </div>

            {cuenta.abonos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[var(--cs)] uppercase tracking-wide mb-2">Abonos</p>
                <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <Table columns={colsAbonos.filter(c => c.key !== 'cliente')} data={cuenta.abonos} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Anular abono */}
      <Modal open={!!anularAbono} onClose={() => setAnular(null)} title="Anular abono" size="sm">
        {anularAbono && (
          <>
            <p className="text-sm text-[#5F6B7A] mb-5">
              ¿Anular el abono de <strong>{formatCurrency(anularAbono.monto)}</strong> a la factura {formatoNumeroFactura(anularAbono.numero_factura)}?
              El monto vuelve al saldo de la factura{anularAbono.metodo_pago === 'efectivo' ? ' y deja de contar en la caja' : ''}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnular(null)}>Volver</Button>
              <Button variant="danger" loading={anular.isPending} onClick={() => anular.mutate(anularAbono.id)}>Anular abono</Button>
            </div>
          </>
        )}
      </Modal>

      <AbonoModal destino={abono} empresaId={empresaId} onClose={() => setAbono(null)} />
    </div>
  )
}

function Monto({ v, venc }: { v: number; venc?: boolean }) {
  if (v <= 0) return <span className="text-gray-300">—</span>
  return <span className={venc ? 'text-red-600 font-semibold' : 'text-[var(--cs)]'}>{formatCurrency(v)}</span>
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value?: number; sub?: string; tone: 'blue' | 'green' | 'red' }) {
  const tones = { blue: 'bg-[var(--cp)]/10 text-[var(--cp)]', green: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600' }
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
