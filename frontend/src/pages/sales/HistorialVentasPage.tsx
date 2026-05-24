import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { ventasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Venta, EstadoVenta } from '@/types'

function EstadoBadge({ estado }: { estado: EstadoVenta }) {
  return estado === 'completada'
    ? <Badge variant="green">Completada</Badge>
    : <Badge variant="red">Cancelada</Badge>
}

export default function HistorialVentasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [cancelarId, setCancelarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ventas', empresaId, page, search],
    queryFn:  () => ventasApi.list({ empresa_id: empresaId, page, per_page: 15, search: search || undefined }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const cancelar = useMutation({
    mutationFn: (id: number) => ventasApi.cancelar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      setCancelarId(null)
      setActionError('')
    },
    onError: (err) => setActionError(getAxiosError(err)),
  })

  const columns: Column<Venta>[] = [
    {
      key: 'numero_factura', header: 'N° Factura',
      cell: r => <span className="font-mono text-sm font-bold text-[#0E78D8]">{r.numero_factura ?? '—'}</span>,
      width: '120px',
    },
    {
      key: 'cliente', header: 'Cliente',
      cell: r => <span className="font-semibold text-[#072B5A]">{r.cliente?.nombre ?? 'Consumidor final'}</span>,
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
      key: 'total', header: 'Total',
      cell: r => <span className="font-bold text-emerald-600">{formatCurrency(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => <EstadoBadge estado={r.estado} />,
      align: 'center', width: '110px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '60px',
      cell: r => r.estado === 'completada' ? (
        <button
          onClick={() => { setCancelarId(r.id); setActionError('') }}
          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Cancelar venta"
        >
          <XCircle size={15} />
        </button>
      ) : null,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Historial de Ventas</h1>
        <p className="text-sm text-[#5F6B7A]">Consulta y gestiona todas las facturas emitidas</p>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Buscar por N° factura, cliente..."
            className="max-w-sm"
          />
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay ventas registradas." />
        {data?.meta && (
          <Pagination
            currentPage={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            onPage={setPage}
          />
        )}
      </div>

      {/* Confirmar cancelar */}
      <Modal open={cancelarId !== null} onClose={() => setCancelarId(null)} title="Cancelar venta" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Cancelar esta venta? El stock <strong>no</strong> se revertirá automáticamente — registra un movimiento de entrada si es necesario.
        </p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelarId(null)}>Volver</Button>
          <Button variant="danger" loading={cancelar.isPending} onClick={() => cancelar.mutate(cancelarId!)}>Cancelar venta</Button>
        </div>
      </Modal>
    </div>
  )
}
