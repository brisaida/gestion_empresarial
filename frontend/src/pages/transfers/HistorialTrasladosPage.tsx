import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { transferenciasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { formatNumber } from '@/lib/utils'
import type { Transferencia, EstadoTraslado } from '@/types'

const estadoConfig: Record<EstadoTraslado, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700' },
  completada: { label: 'Completada', cls: 'bg-emerald-50 text-emerald-700' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-50 text-red-700' },
}

function EstadoBadge({ estado }: { estado: EstadoTraslado }) {
  const { label, cls } = estadoConfig[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

function DetalleFila({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['transferencia', id],
    queryFn:  () => transferenciasApi.get(id).then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <p className="text-xs text-[#5F6B7A] py-2">Cargando detalles…</p>
  if (!data?.detalles?.length) return <p className="text-xs text-[#5F6B7A] py-2">Sin detalles.</p>

  return (
    <div className="bg-[#F4F7FA] rounded-lg overflow-hidden mt-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-3 py-2 text-[#5F6B7A] font-semibold">Producto</th>
            <th className="text-right px-3 py-2 text-[#5F6B7A] font-semibold w-24">Cantidad</th>
            <th className="text-left px-3 py-2 text-[#5F6B7A] font-semibold hidden sm:table-cell">Lote / Serie</th>
          </tr>
        </thead>
        <tbody>
          {data.detalles.map(det => (
            <tr key={det.id} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 text-[#072B5A] font-medium">
                {det.producto?.nombre ?? `#${det.producto_id}`}
                {det.producto?.codigo && <span className="ml-1 text-[#5F6B7A]">[{det.producto.codigo}]</span>}
              </td>
              <td className="px-3 py-2 text-right font-bold text-[#072B5A]">{formatNumber(det.cantidad)}</td>
              <td className="px-3 py-2 text-[#5F6B7A] hidden sm:table-cell">
                {det.lote && <span>Lote: {det.lote}</span>}
                {det.numero_serie && <span>{det.lote ? ' · ' : ''}Serie: {det.numero_serie}</span>}
                {!det.lote && !det.numero_serie && '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function HistorialTrasladosPage() {
  const { state } = useAuth()
  const empresaId  = state.empresaActiva?.id ?? 0

  const [page, setPage]         = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transferencias', empresaId, page],
    queryFn:  () => transferenciasApi.list({ empresa_id: empresaId, page, per_page: 15 }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const toggle = (id: number) => setExpanded(prev => prev === id ? null : id)

  const columns: Column<Transferencia>[] = [
    {
      key: 'id', header: 'ID',
      cell: r => <span className="font-mono text-sm font-bold text-[#0E78D8]">#{r.id}</span>,
      width: '70px',
    },
    {
      key: 'ruta', header: 'Ruta',
      cell: r => (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#072B5A]">
          {r.bodega_origen}
          <ArrowRight size={13} className="text-[#0E78D8] shrink-0" />
          {r.bodega_destino}
        </span>
      ),
    },
    {
      key: 'fecha_transferencia', header: 'Fecha',
      cell: r => <span className="text-[#5F6B7A] text-sm">{r.fecha_transferencia}</span>,
      align: 'center', width: '110px',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => <EstadoBadge estado={r.estado} />,
      align: 'center', width: '110px',
    },
    {
      key: 'observaciones', header: 'Observaciones',
      cell: r => <span className="text-[#5F6B7A] text-xs">{r.observaciones ?? '—'}</span>,
    },
    {
      key: 'acciones', header: '', align: 'right', width: '60px',
      cell: r => (
        <button
          onClick={() => toggle(r.id)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100 transition-colors"
          title="Ver detalle"
        >
          {expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Historial de Traslados</h1>
        <p className="text-sm text-[#5F6B7A]">Movimientos entre bodegas registrados en el sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          error={isError ? 'Error al cargar los traslados.' : undefined}
          emptyMessage="No hay traslados registrados."
          expandedRow={expanded !== null ? {
            id: expanded,
            content: <DetalleFila id={expanded} />,
          } : undefined}
        />
        {data?.meta && (
          <Pagination
            currentPage={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            onPage={setPage}
          />
        )}
      </div>
    </div>
  )
}
