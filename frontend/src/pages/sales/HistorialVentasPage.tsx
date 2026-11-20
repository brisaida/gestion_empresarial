import { useState } from 'react'
import type React from 'react'
import { XCircle, Download, Loader2, Banknote, CreditCard, ArrowLeftRight, Layers, Clock, HandCoins, Undo2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { ventasApi, empresaApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, getAxiosError, cn } from '@/lib/utils'
import AbonoModal, { type AbonoDestino } from '@/components/credito/AbonoModal'
import EstadoPagoBadge from '@/components/credito/EstadoPagoBadge'
import DevolucionModal, { type DevolucionDestino } from '@/components/credito/DevolucionModal'
import { formatoNumeroFactura } from '@/lib/printVenta'
import type { Venta, EstadoVenta, MetodoPago } from '@/types'

function EstadoBadge({ estado }: { estado: EstadoVenta }) {
  return estado === 'completada'
    ? <Badge variant="green">Completada</Badge>
    : <Badge variant="red">Cancelada</Badge>
}


const metodoPagoInfo: Record<MetodoPago, { icon: React.ElementType; label: string; cls: string }> = {
  efectivo:      { icon: Banknote,       label: 'Efectivo',      cls: 'text-emerald-700 bg-emerald-50' },
  tarjeta:       { icon: CreditCard,     label: 'Tarjeta',       cls: 'text-blue-700 bg-blue-50'       },
  transferencia: { icon: ArrowLeftRight, label: 'Transferencia', cls: 'text-purple-700 bg-purple-50'   },
  mixto:         { icon: Layers,         label: 'Mixto',         cls: 'text-amber-700 bg-amber-50'     },
}

function MetodoPagoBadge({ metodo }: { metodo?: string | null }) {
  const key = (metodo ?? 'efectivo') as MetodoPago
  const { icon: Icon, label, cls } = metodoPagoInfo[key] ?? metodoPagoInfo.efectivo
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}

export default function HistorialVentasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [cancelarId, setCancelarId]   = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [loadingPdf, setLoadingPdf]   = useState<number | null>(null)
  const [pdfError, setPdfError]       = useState('')
  const [condicion, setCondicion]     = useState<'' | 'contado' | 'credito'>('')
  const [abono, setAbono]             = useState<AbonoDestino | null>(null)
  const [devolucion, setDevolucion]   = useState<DevolucionDestino | null>(null)
  const [motivo, setMotivo]           = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ventas', empresaId, page, search, condicion],
    queryFn:  () => ventasApi.list({ empresa_id: empresaId, page, per_page: 15, search: search || undefined, condicion: condicion || undefined }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const cancelar = useMutation({
    mutationFn: (id: number) => ventasApi.cancelar(id, motivo.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['cxc'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['productos-all'] })
      setCancelarId(null)
      setActionError('')
    },
    onError: (err) => setActionError(getAxiosError(err)),
  })

  /* ── Botón PDF ────────────────────────────────────────────────── */
  const handlePdf = async (venta: Venta) => {
    setPdfError('')
    setLoadingPdf(venta.id)
    try {
      const [ventaRes, empresaRes] = await Promise.all([
        ventasApi.get(venta.id),
        empresaApi.get(empresaId),
      ])
      const emp = empresaRes.data.data
      if (emp.tipo_facturacion === 'ticket') {
        const { printTicket } = await import('@/lib/printTicket')
        printTicket(ventaRes.data.data, emp)
      } else {
        const [logoRes, { printVenta }] = await Promise.all([
          empresaApi.logoBase64(empresaId),
          import('@/lib/printVenta'),
        ])
        printVenta(ventaRes.data.data, emp, logoRes.data.data.logo_base64 ?? undefined)
      }
    } catch (err) {
      console.error('Error generando documento:', err)
      setPdfError('No se pudo generar el documento.')
    } finally {
      setLoadingPdf(null)
    }
  }

  const columns: Column<Venta>[] = [
    {
      key: 'numero_factura', header: 'N° Factura',
      cell: r => <span className="font-mono text-sm font-bold text-[var(--cp)]">{r.numero_factura ?? '—'}</span>,
      width: '120px',
    },
    {
      key: 'cliente', header: 'Cliente',
      cell: r => <span className="font-semibold text-[var(--cs)]">{r.cliente?.nombre ?? 'Consumidor final'}</span>,
    },
    {
      key: 'bodega', header: 'Bodega',
      cell: r => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span>,
    },
    {
      key: 'fecha_venta', header: 'Fecha',
      cell: r => <span className="text-[#5F6B7A]">{r.fecha_venta}</span>,
      align: 'center',
    },
    {
      key: 'metodo_pago', header: 'Pago',
      cell: r => r.condicion === 'credito' ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-orange-700 bg-orange-50">
            <Clock size={11} /> Crédito
          </span>
          {r.estado === 'completada' && <EstadoPagoBadge venta={r} />}
        </div>
      ) : <MetodoPagoBadge metodo={r.metodo_pago} />,
      align: 'center', width: '130px',
    },
    {
      key: 'total', header: 'Total',
      cell: r => (
        <div className="text-right leading-tight">
          <span className="font-bold text-emerald-600">{formatCurrency(r.total)}</span>
          {r.condicion === 'credito' && r.estado === 'completada' && (r.saldo_pendiente ?? 0) > 0 && (
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
          {r.estado === 'cancelada' && r.motivo_cancelacion && (
            <span className="text-[10px] text-[#5F6B7A] max-w-[120px] truncate">{r.motivo_cancelacion}</span>
          )}
          {(r.monto_devuelto ?? 0) > 0 && (
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 rounded-full">
              {(r.monto_devuelto ?? 0) >= r.total - (r.costo_envio ?? 0) - 0.01 ? 'Devuelta' : 'Devolución'} {formatCurrency(r.monto_devuelto ?? 0)}
            </span>
          )}
        </div>
      ),
      align: 'center', width: '130px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '160px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          {r.condicion === 'credito' && r.estado === 'completada' && (r.saldo_pendiente ?? 0) > 0 && (
            <button
              onClick={() => setAbono({
                ventaId: r.id, saldo: r.saldo_pendiente ?? 0, vence: r.fecha_vencimiento,
                titulo: `Factura ${formatoNumeroFactura(r.numero_factura)}${r.cliente ? ` · ${r.cliente.nombre}` : ''}`,
              })}
              className="p-1.5 rounded text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors"
              title="Registrar abono"
            >
              <HandCoins size={15} />
            </button>
          )}
          {/* Botón PDF */}
          <button
            onClick={() => handlePdf(r)}
            disabled={loadingPdf === r.id}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Descargar PDF"
          >
            {loadingPdf === r.id
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />
            }
            PDF
          </button>

          {/* Devolución */}
          {r.estado === 'completada' && (
            <button
              onClick={() => setDevolucion({ tipo: 'venta', id: r.id })}
              className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="Devolución del cliente"
            >
              <Undo2 size={15} />
            </button>
          )}

          {/* Cancelar (solo sin devoluciones) */}
          {r.estado === 'completada' && !(r.monto_devuelto ?? 0) && (
            <button
              onClick={() => { setCancelarId(r.id); setActionError(''); setMotivo('') }}
              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Cancelar venta"
            >
              <XCircle size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Historial de Ventas</h1>
        <p className="text-sm text-[#5F6B7A]">Consulta y gestiona todas las facturas emitidas</p>
      </div>

      {pdfError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <XCircle size={16} className="shrink-0" />{pdfError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchBar
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Buscar por N° factura, cliente..."
            className="max-w-sm w-full"
          />
          <div className="flex items-center gap-1 bg-[#F4F7FA] border border-gray-200 rounded-lg p-1 w-fit">
            {([['', 'Todas'], ['contado', 'Contado'], ['credito', 'Crédito']] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setCondicion(k); setPage(1) }}
                className={cn('px-3 py-1 rounded-md text-sm font-semibold transition-all',
                  condicion === k ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} error={isError ? 'Error al cargar el historial de ventas.' : undefined} emptyMessage="No hay ventas registradas." />
        {data?.meta && (
          <Pagination
            currentPage={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            onPage={setPage}
          />
        )}
      </div>

      <AbonoModal destino={abono} empresaId={empresaId} onClose={() => setAbono(null)} />
      <DevolucionModal destino={devolucion} empresaId={empresaId} onClose={() => setDevolucion(null)} />

      {/* Confirmar cancelar */}
      <Modal open={cancelarId !== null} onClose={() => setCancelarId(null)} title="Cancelar venta" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Cancelar esta venta? Los productos vuelven al stock de la bodega de donde salieron.
        </p>
        {data?.data.find(v => v.id === cancelarId)?.condicion === 'credito' && (
          <p className="text-sm text-[#5F6B7A] mb-4">Es una venta al crédito: su saldo deja de contar en cuentas por cobrar. Si tiene abonos, anúlalos primero.</p>
        )}
        <p className="text-xs text-[#5F6B7A] mb-3">Si el cliente solo devuelve algunos productos, usa <strong>Devolución</strong> en lugar de cancelar.</p>
        <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Motivo *</label>
        <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Error al facturar, cliente se arrepintió…"
          className="w-full mb-4 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30" />
        {actionError && <p className="mb-4 text-sm text-red-600 whitespace-pre-line">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending} disabled={motivo.trim().length < 3} onClick={() => cancelar.mutate(cancelarId!)}>Cancelar venta</Button>
        </div>
      </Modal>
    </div>
  )
}
