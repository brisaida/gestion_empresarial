import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { existenciasApi, bodegasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import SearchBar from '@/components/ui/SearchBar'
import { formatNumber } from '@/lib/utils'
import type { Existencia } from '@/types'

export default function ExistenciasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['existencias', empresaId, page, bodegaId, soloStockBajo],
    queryFn:  () => existenciasApi.list({ empresa_id: empresaId, page, per_page: 20, bodega_id: bodegaId || undefined, stock_bajo: soloStockBajo || undefined }).then((r) => r.data),
    enabled:  empresaId > 0,
    placeholderData: (p) => p,
  })

  const columns: Column<Existencia>[] = [
    {
      key: 'producto', header: 'Producto',
      cell: (r) => (
        <div>
          <p className="font-semibold text-[#072B5A]">{r.producto?.nombre ?? '—'}</p>
          {r.producto?.codigo && <p className="text-xs text-[#5F6B7A] font-mono">{r.producto.codigo}</p>}
        </div>
      ),
    },
    { key: 'bodega', header: 'Bodega',       cell: (r) => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span> },
    { key: 'lote',   header: 'Lote / Serie', cell: (r) => <span className="text-[#5F6B7A] font-mono text-xs">{r.lote ?? r.numero_serie ?? '—'}</span> },
    { key: 'fecha_vencimiento', header: 'Vencimiento', cell: (r) => <span className="text-[#5F6B7A]">{r.fecha_vencimiento ?? '—'}</span>, align: 'center' },
    {
      key: 'cantidad', header: 'Disponible', align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.producto?.stock_bajo ? (
            <AlertTriangle size={14} className="text-amber-500" />
          ) : (
            <CheckCircle size={14} className="text-emerald-400" />
          )}
          <span className={`font-bold ${r.producto?.stock_bajo ? 'text-amber-600' : 'text-[#072B5A]'}`}>
            {formatNumber(r.cantidad_disponible)}
          </span>
        </div>
      ),
    },
    {
      key: 'estado', header: 'Stock', align: 'center',
      cell: (r) => r.producto?.stock_bajo
        ? <Badge variant="yellow">Stock bajo</Badge>
        : <Badge variant="green">Normal</Badge>,
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Stock / Existencias</h1>
        <p className="text-sm text-[#5F6B7A]">Inventario disponible por bodega</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Buscar producto..." className="w-64" />

          <select
            value={bodegaId}
            onChange={(e) => { setBodegaId(e.target.value); setPage(1) }}
            className="text-sm rounded-lg border border-gray-200 px-3 py-2 text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all"
          >
            <option value="">Todas las bodegas</option>
            {bodegas?.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer font-medium">
            <input type="checkbox" checked={soloStockBajo} onChange={(e) => setSoloStockBajo(e.target.checked)} className="rounded accent-[#0E78D8]" />
            Solo stock bajo
          </label>
        </div>

        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay existencias con esos filtros." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>
    </div>
  )
}
