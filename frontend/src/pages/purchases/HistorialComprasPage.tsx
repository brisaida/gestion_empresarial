import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Package, Clock, Banknote, Pencil, Undo2, Printer } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comprasApi, empresaApi, devolucionesApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, formatDate, getAxiosError, cn } from '@/lib/utils'
import type { Compra, EstadoCompra, MetodoPagoCompra } from '@/types'
import PagoProveedorModal, { type PagoDestino } from '@/components/credito/PagoProveedorModal'
import { METODO_COMPRA_LABEL } from '@/lib/metodosPago'
import EstadoPagoBadge from '@/components/credito/EstadoPagoBadge'
import DevolucionModal, { type DevolucionDestino } from '@/components/credito/DevolucionModal'
import { printDevolucion } from '@/lib/printCredito'


const estadoMap: Record<EstadoCompra, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
  recibida:  { label: 'Recibida',  cls: 'bg-emerald-50 text-emerald-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 text-red-700' },
}

function EstadoBadge({ estado }: { estado: EstadoCompra }) {
  const { label, cls } = estadoMap[estado]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

type Filtro = 'todas' | EstadoCompra
const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas',     label: 'Todas'     },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'recibida',  label: 'Recibida'  },
  { key: 'cancelada', label: 'Cancelada' },
]

async function imprimirDevolucion(id: number, empresaId: number) {
  try {
    const [dev, emp, logo] = await Promise.all([
      devolucionesApi.compra(id), empresaApi.get(empresaId), empresaApi.logoBase64(empresaId),
    ])
    printDevolucion(dev.data.data, 'proveedor', emp.data.data, logo.data.data.logo_base64 ?? undefined)
  } catch { /* el comprobante es opcional */ }
}

function DetalleFila({ id, empresaId }: { id: number; empresaId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['compras', 'detalle', id],
    queryFn:  () => comprasApi.get(id).then(r => r.data.data),
  })

  if (isLoading) return <p className="text-xs text-[#5F6B7A] py-3 px-4">Cargando...</p>

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Package size={11} /> Productos
      </p>
      <div className="space-y-1">
        {data?.detalles?.map(d => (
          <div key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-[var(--cs)] truncate">{d.producto?.nombre ?? '—'}</span>
              {d.lote && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">Lote: {d.lote}</span>}
              {d.fecha_vencimiento && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Vence: {d.fecha_vencimiento}</span>}
            </div>
            <div className="flex items-center gap-6 shrink-0 text-right">
              {(d.cantidad_devuelta ?? 0) > 0 && <span className="text-[11px] font-semibold text-purple-700">devuelto {d.cantidad_devuelta}</span>}
              <span className="text-[#5F6B7A] w-24">× {d.cantidad} u.</span>
              <span className="text-[#5F6B7A] w-28">@ {formatCurrency(d.costo_unitario)}</span>
              <span className="font-semibold text-[var(--cs)] w-28">{formatCurrency(d.subtotal)}</span>
            </div>
          </div>
        ))}
        {(data?.costo_envio ?? 0) > 0 && (
          <div className="flex items-center justify-between text-sm py-1.5">
            <span className="font-medium text-[#5F6B7A]">Envío / flete</span>
            <span className="font-semibold text-[var(--cs)] w-28 text-right">{formatCurrency(data!.costo_envio!)}</span>
          </div>
        )}
      </div>
      {data?.motivo_cancelacion && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          Cancelada{data.cancelada_por ? ` por ${data.cancelada_por}` : ''}: {data.motivo_cancelacion}
        </p>
      )}
      {(data?.devoluciones?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Undo2 size={11} /> Devoluciones al proveedor</p>
          {data!.devoluciones!.map(dv => (
            <div key={dv.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
              <span className="text-[#5F6B7A]"><span className="font-mono font-semibold text-purple-700">{dv.numero}</span> · {formatDate(dv.fecha)} · {dv.motivo}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-[var(--cs)]">− {formatCurrency(dv.total)}</span>
                <button onClick={() => imprimirDevolucion(dv.id, empresaId)} title="Imprimir comprobante" className="p-1 rounded text-gray-400 hover:text-[var(--cp)]"><Printer size={13} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistorialComprasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [filtro, setFiltro]     = useState<Filtro>('todas')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [recibirId, setRecibirId]   = useState<number | null>(null)
  const [cancelarId, setCancelarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [condicionFiltro, setCondicionFiltro] = useState<'' | 'contado' | 'credito'>('')
  const [pago, setPago]           = useState<PagoDestino | null>(null)
  const [editCond, setEditCond]   = useState<Compra | null>(null)
  const [devolucion, setDevolucion] = useState<DevolucionDestino | null>(null)
  const [motivo, setMotivo]       = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['compras', empresaId, page, filtro, search, condicionFiltro],
    queryFn:  () => comprasApi.list({
      empresa_id: empresaId,
      page,
      per_page: 15,
      estado:   filtro !== 'todas' ? filtro : undefined,
      search:   search || undefined,
      condicion: condicionFiltro || undefined,
    }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const recibir = useMutation({
    mutationFn: (id: number) => comprasApi.recibir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      setRecibirId(null); setActionError('')
    },
    onError: err => setActionError(getAxiosError(err)),
  })

  const cancelar = useMutation({
    mutationFn: (id: number) => comprasApi.cancelar(id, motivo.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      setCancelarId(null); setActionError('')
    },
    onError: err => setActionError(getAxiosError(err)),
  })

  const toggleExpand = (id: number) => setExpanded(prev => prev === id ? null : id)

  const columns: Column<Compra>[] = [
    {
      key: 'expand', header: '', width: '40px',
      cell: r => (
        <button onClick={() => toggleExpand(r.id)}
          className="p-1 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-white/10 transition-colors">
          {expanded === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ),
    },
    {
      key: 'numero_factura', header: 'Factura',
      cell: r => <span className="font-mono text-xs text-[#5F6B7A]">{r.numero_factura ?? '—'}</span>,
      width: '110px',
    },
    {
      key: 'proveedor', header: 'Proveedor',
      cell: r => <span className="font-semibold text-[var(--cs)]">{r.proveedor?.nombre ?? '—'}</span>,
    },
    {
      key: 'bodega', header: 'Bodega destino',
      cell: r => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span>,
    },
    {
      key: 'fecha_compra', header: 'Fecha',
      cell: r => <span className="text-[#5F6B7A]">{r.fecha_compra}</span>,
      align: 'center',
    },
    {
      key: 'pago', header: 'Pago', align: 'center', width: '140px',
      cell: r => r.condicion === 'credito' ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-orange-700 bg-orange-50">
            <Clock size={11} /> Crédito
          </span>
          {r.estado !== 'cancelada' && <EstadoPagoBadge venta={r} pendiente="Por pagar" />}
        </div>
      ) : (
        <span className="text-xs font-semibold text-[#5F6B7A]">
          {r.metodo_pago ? METODO_COMPRA_LABEL[r.metodo_pago] : 'Contado'}
        </span>
      ),
    },
    {
      key: 'total', header: 'Total',
      cell: r => (
        <div className="text-right leading-tight">
          <span className="font-bold text-[var(--cs)]">{formatCurrency(r.total)}</span>
          {r.condicion === 'credito' && r.estado !== 'cancelada' && (r.saldo_pendiente ?? 0) > 0 && (
            <p className="text-[11px] text-[#5F6B7A]">Saldo {formatCurrency(r.saldo_pendiente ?? 0)}</p>
          )}
        </div>
      ),
      align: 'right',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => (
        <div className="flex flex-col items-center gap-0.5" title={r.motivo_cancelacion ? `Motivo: ${r.motivo_cancelacion}` : undefined}>
          <EstadoBadge estado={r.estado} />
          {(r.monto_devuelto ?? 0) > 0 && (
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 rounded-full">Devolución {formatCurrency(r.monto_devuelto ?? 0)}</span>
          )}
        </div>
      ),
      align: 'center', width: '130px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '200px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          {r.condicion === 'credito' && r.estado !== 'cancelada' && (r.saldo_pendiente ?? 0) > 0 && (
            <button
              onClick={() => setPago({
                compraId: r.id, saldo: r.saldo_pendiente ?? 0, vence: r.fecha_vencimiento,
                titulo: `Factura ${r.numero_factura ?? `#${r.id}`}${r.proveedor ? ` · ${r.proveedor.nombre}` : ''}`,
              })}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors"
              title="Registrar pago">
              <Banknote size={13} /> Pagar
            </button>
          )}
          {r.estado === 'recibida' && (
            <button onClick={() => setDevolucion({ tipo: 'compra', id: r.id })}
              className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="Devolver al proveedor">
              <Undo2 size={13} />
            </button>
          )}
          {r.estado !== 'cancelada' && (
            <button onClick={() => setEditCond(r)}
              className="p-1.5 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100 transition-colors"
              title="Cambiar contado / crédito">
              <Pencil size={13} />
            </button>
          )}
          {r.estado === 'pendiente' && (<>
          <button
            onClick={() => { setRecibirId(r.id); setActionError('') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Recibir mercancía">
            <CheckCircle size={13} /> Recibir
          </button>
          <button
            onClick={() => { setCancelarId(r.id); setActionError(''); setMotivo('') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            title="Cancelar orden">
            <XCircle size={13} /> Cancelar
          </button>
          </>)}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Historial de Compras</h1>
        <p className="text-sm text-[#5F6B7A]">Gestiona tus órdenes de compra — recibe o cancela las pendientes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filtros + búsqueda */}
        <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-1">
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => { setFiltro(f.key); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === f.key
                    ? 'bg-[var(--cp)] text-white shadow-sm'
                    : 'text-[#5F6B7A] hover:bg-gray-100'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#F4F7FA] border border-gray-200 rounded-lg p-1">
              {([['', 'Todas'], ['contado', 'Contado'], ['credito', 'Crédito']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setCondicionFiltro(k); setPage(1) }}
                  className={cn('px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    condicionFiltro === k ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
                  {l}
                </button>
              ))}
            </div>
            <SearchBar
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              placeholder="Buscar por factura o proveedor..."
              className="max-w-xs"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          error={isError ? 'Error al cargar las compras.' : undefined}
          emptyMessage="No hay órdenes de compra registradas."
          expandedRow={expanded !== null ? { id: expanded, content: <DetalleFila id={expanded} empresaId={empresaId} /> } : undefined}
        />
        {data?.meta && (
          <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
        )}
      </div>

      <PagoProveedorModal destino={pago} onClose={() => setPago(null)} />
      <CondicionModal compra={editCond} onClose={() => setEditCond(null)} />
      <DevolucionModal destino={devolucion} empresaId={empresaId} onClose={() => setDevolucion(null)} />

      {/* Confirmar recibir */}
      <Modal open={recibirId !== null} onClose={() => setRecibirId(null)} title="Recibir orden de compra" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Confirmar recepción? El stock de cada producto será actualizado en la bodega de destino.
        </p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRecibirId(null)}>Cancelar</Button>
          <Button loading={recibir.isPending} icon={<CheckCircle size={15} />}
            onClick={() => recibir.mutate(recibirId!)}>
            Confirmar recepción
          </Button>
        </div>
      </Modal>

      {/* Confirmar cancelar */}
      <Modal open={cancelarId !== null} onClose={() => setCancelarId(null)} title="Cancelar orden de compra" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Cancelar esta orden? El stock no será afectado ya que no fue recibida.
        </p>
        <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Motivo *</label>
        <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Pedido duplicado, el proveedor no tenía…"
          className="w-full mb-4 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30" />
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending} disabled={motivo.trim().length < 3}
            onClick={() => cancelar.mutate(cancelarId!)}>
            Cancelar orden
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Cambiar contado / crédito de una compra registrada ──────────────────────
function CondicionModal({ compra, onClose }: { compra: Compra | null; onClose: () => void }) {
  return (
    <Modal open={!!compra} onClose={onClose} title="Condición de pago" size="sm">
      {compra && <CondicionForm key={compra.id} compra={compra} onClose={onClose} />}
    </Modal>
  )
}

function CondicionForm({ compra, onClose }: { compra: Compra; onClose: () => void }) {
  const qc = useQueryClient()
  const [condicion, setCondicion] = useState<'contado' | 'credito'>(compra.condicion ?? 'contado')
  const [metodo, setMetodo]       = useState<MetodoPagoCompra>(compra.metodo_pago ?? 'efectivo')
  const [dias, setDias]           = useState(compra.dias_credito != null ? String(compra.dias_credito) : '')
  const [error, setError]         = useState('')

  const guardar = useMutation({
    mutationFn: () => comprasApi.cambiarCondicion(compra.id, condicion === 'credito'
      ? { condicion, dias_credito: dias === '' ? null : Number(dias) }
      : { condicion, metodo_pago: metodo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['cxp'] })
      qc.invalidateQueries({ queryKey: ['proveedores'] })
      onClose()
    },
    onError: err => setError(getAxiosError(err)),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#5F6B7A]">
        Factura <strong>{compra.numero_factura ?? `#${compra.id}`}</strong> · {compra.proveedor?.nombre} · {formatCurrency(compra.total)} · {formatDate(compra.fecha_compra)}
      </p>
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
        {(['contado', 'credito'] as const).map(c => (
          <button key={c} type="button" onClick={() => setCondicion(c)}
            className={cn('py-1.5 rounded-md text-sm font-semibold transition-all',
              condicion === c ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
            {c === 'contado' ? 'Contado' : 'Crédito'}
          </button>
        ))}
      </div>
      {condicion === 'contado' ? (
        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Se pagó con</label>
          <select value={metodo} onChange={e => setMetodo(e.target.value as MetodoPagoCompra)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] bg-white">
            {(Object.keys(METODO_COMPRA_LABEL) as MetodoPagoCompra[]).map(m => <option key={m} value={m}>{METODO_COMPRA_LABEL[m]}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Días de crédito</label>
          <input type="number" min="0" max="365" value={dias} onChange={e => setDias(e.target.value)}
            placeholder="Los del proveedor (o 30)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)]" />
          <p className="text-[11px] text-[#5F6B7A] mt-1">El vencimiento se cuenta desde la fecha de la compra.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button loading={guardar.isPending} onClick={() => guardar.mutate()}>Guardar</Button>
      </div>
    </div>
  )
}
