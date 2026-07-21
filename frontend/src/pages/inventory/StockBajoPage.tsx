import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { existenciasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import SearchBar from '@/components/ui/SearchBar'
import { formatNumber } from '@/lib/utils'
import type { Existencia } from '@/types'

function NivelBar({ cantidad, minimo }: { cantidad: number; minimo: number }) {
  if (cantidad === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-red-500" style={{ width: '100%' }} />
        </div>
        <span className="text-xs text-red-600 w-8 text-right font-medium">0%</span>
      </div>
    )
  }
  if (minimo <= 0) return null
  const pct = Math.min((cantidad / minimo) * 100, 100)
  const color = pct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#5F6B7A] w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

export default function StockBajoPage() {
  const { state } = useAuth()
  const empresaId  = state.empresaActiva?.id ?? 0

  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['existencias-stock-bajo', empresaId, page, search],
    queryFn:  () => existenciasApi.list({
      empresa_id: empresaId,
      stock_bajo: true,
      per_page:   20,
      page,
      search: search || undefined,
    }).then(r => r.data),
    enabled: empresaId > 0,
    placeholderData: p => p,
  })

  const columns: Column<Existencia>[] = [
    {
      key: 'producto', header: 'Producto',
      cell: r => (
        <div>
          <p className="font-semibold text-[#072B5A]">{r.producto?.nombre ?? `#${r.producto_id}`}</p>
          {r.producto?.codigo && <p className="text-xs text-[#5F6B7A] font-mono">{r.producto.codigo}</p>}
        </div>
      ),
    },
    {
      key: 'bodega', header: 'Bodega',
      cell: r => <span className="text-sm text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span>,
      width: '150px',
    },
    {
      key: 'cantidad', header: 'Stock actual',
      align: 'right', width: '110px',
      cell: r => (
        <span className={`font-bold text-sm ${r.cantidad === 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {formatNumber(r.cantidad)}
        </span>
      ),
    },
    {
      key: 'stock_minimo', header: 'Mínimo',
      align: 'right', width: '90px',
      cell: r => <span className="text-sm text-[#5F6B7A]">{formatNumber(r.producto?.stock_minimo ?? 0)}</span>,
    },
    {
      key: 'deficit', header: 'Déficit',
      align: 'right', width: '90px',
      cell: r => {
        const deficit = (r.producto?.stock_minimo ?? 0) - r.cantidad
        return deficit > 0
          ? <span className="text-sm font-semibold text-red-600">−{formatNumber(deficit)}</span>
          : <span className="text-sm text-emerald-600">OK</span>
      },
    },
    {
      key: 'nivel', header: 'Nivel',
      width: '140px',
      cell: r => <NivelBar cantidad={r.cantidad} minimo={r.producto?.stock_minimo ?? 0} />,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A] flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Alertas de Stock
          </h1>
          <p className="text-sm text-[#5F6B7A] mt-0.5">
            Productos con stock en cero o por debajo del mínimo configurado
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] hover:text-[#0E78D8] transition-colors px-3 py-2 rounded-lg hover:bg-[#F4F7FA]"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {!isLoading && !isError && data?.data.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <p className="font-semibold text-emerald-700">Todo el stock está sobre el mínimo</p>
            <p className="text-sm text-emerald-600">No hay productos que requieran reabastecimiento.</p>
          </div>
        </div>
      )}

      {(isLoading || isError || (data?.data.length ?? 0) > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }}
              placeholder="Buscar producto…" className="max-w-sm" />
          </div>
          <Table
            columns={columns}
            data={data?.data ?? []}
            loading={isLoading}
            error={isError ? 'Error al cargar el stock.' : undefined}
            emptyMessage="No hay productos bajo el mínimo."
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
      )}
    </div>
  )
}
