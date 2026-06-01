import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comprasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Compra, EstadoCompra } from '@/types'

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

function DetalleFila({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['compra-detalle', id],
    queryFn:  () => comprasApi.get(id).then(r => r.data.data),
    staleTime: 60_000,
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
              <span className="font-medium text-[#072B5A] truncate">{d.producto?.nombre ?? '—'}</span>
              {d.lote && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">Lote: {d.lote}</span>}
              {d.fecha_vencimiento && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Vence: {d.fecha_vencimiento}</span>}
            </div>
            <div className="flex items-center gap-6 shrink-0 text-right">
              <span className="text-[#5F6B7A] w-24">× {d.cantidad} u.</span>
              <span className="text-[#5F6B7A] w-28">@ {formatCurrency(d.costo_unitario)}</span>
              <span className="font-semibold text-[#072B5A] w-28">{formatCurrency(d.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
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

  const { data, isLoading } = useQuery({
    queryKey: ['compras', empresaId, page, filtro, search],
    queryFn:  () => comprasApi.list({
      empresa_id: empresaId,
      page,
      per_page: 15,
      estado:   filtro !== 'todas' ? filtro : undefined,
      search:   search || undefined,
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
    mutationFn: (id: number) => comprasApi.cancelar(id),
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
          className="p-1 rounded text-gray-400 hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors">
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
      cell: r => <span className="font-semibold text-[#072B5A]">{r.proveedor?.nombre ?? '—'}</span>,
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
      key: 'total', header: 'Total',
      cell: r => <span className="font-bold text-[#072B5A]">{formatCurrency(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => <EstadoBadge estado={r.estado} />,
      align: 'center', width: '110px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '110px',
      cell: r => r.estado === 'pendiente' ? (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => { setRecibirId(r.id); setActionError('') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Recibir mercancía">
            <CheckCircle size={13} /> Recibir
          </button>
          <button
            onClick={() => { setCancelarId(r.id); setActionError('') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            title="Cancelar orden">
            <XCircle size={13} /> Cancelar
          </button>
        </div>
      ) : null,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Historial de Compras</h1>
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
                    ? 'bg-[#0E78D8] text-white shadow-sm'
                    : 'text-[#5F6B7A] hover:bg-gray-100'
                }`}>
                {f.label}
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

        <Table
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          emptyMessage="No hay órdenes de compra registradas."
          expandedRow={expanded !== null ? { id: expanded, content: <DetalleFila id={expanded} /> } : undefined}
        />
        {data?.meta && (
          <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
        )}
      </div>

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
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending}
            onClick={() => cancelar.mutate(cancelarId!)}>
            Cancelar orden
          </Button>
        </div>
      </Modal>
    </div>
  )
}
