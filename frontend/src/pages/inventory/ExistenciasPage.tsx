import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { existenciasApi, bodegasApi, categoriasApi, productosApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import SearchBar from '@/components/ui/SearchBar'
import ComboBox from '@/components/ui/ComboBox'
import { formatNumber } from '@/lib/utils'
import type { Existencia } from '@/types'

export default function ExistenciasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [exporting, setExporting]   = useState(false)

  const reset = () => { setPage(1) }

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: categorias } = useQuery({
    queryKey: ['categorias-all', empresaId],
    queryFn:  () => categoriasApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: productos } = useQuery({
    queryKey: ['productos-all', empresaId],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, per_page: 500, solo_activos: true }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const filters = {
    empresa_id:   empresaId,
    page,
    per_page:     20,
    search:       search   || undefined,
    bodega_id:    bodegaId    || undefined,
    categoria_id: categoriaId || undefined,
    producto_id:  productoId  || undefined,
    stock_bajo:   soloStockBajo || undefined,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['existencias', empresaId, page, search, bodegaId, categoriaId, productoId, soloStockBajo],
    queryFn:  () => existenciasApi.list(filters).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await existenciasApi.list({ ...filters, page: 1, per_page: 9999 })
      const rows = (res.data.data as Existencia[]).map(r => ({
        'Producto':     r.producto?.nombre ?? '—',
        'Código':       r.producto?.codigo ?? '—',
        'Bodega':       r.bodega?.nombre ?? 'Sin asignar',
        'Disponible':   Number(r.cantidad_disponible ?? r.cantidad),
        'Stock mínimo': Number(r.producto?.stock_minimo ?? 0),
        'Estado':       r.producto?.stock_bajo ? 'Stock bajo' : 'Normal',
      }))
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))
      XLSX.utils.book_append_sheet(wb, ws, 'Stock')
      XLSX.writeFile(wb, `stock_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Existencia>[] = [
    {
      key: 'producto', header: 'Producto',
      cell: r => (
        <div>
          <p className="font-semibold text-[#072B5A]">{r.producto?.nombre ?? '—'}</p>
          {r.producto?.codigo && <p className="text-xs text-[#5F6B7A] font-mono">{r.producto.codigo}</p>}
        </div>
      ),
    },
    { key: 'bodega',  header: 'Bodega',     cell: r => <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span> },
    {
      key: 'cantidad', header: 'Disponible', align: 'right',
      cell: r => (
        <div className="flex items-center justify-end gap-2">
          {r.producto?.stock_bajo
            ? <AlertTriangle size={14} className="text-amber-500" />
            : <CheckCircle   size={14} className="text-emerald-400" />}
          <span className={`font-bold ${r.producto?.stock_bajo ? 'text-amber-600' : 'text-[#072B5A]'}`}>
            {formatNumber(r.cantidad_disponible)}
          </span>
        </div>
      ),
    },
    {
      key: 'estado', header: 'Stock', align: 'center',
      cell: r => r.producto?.stock_bajo
        ? <Badge variant="yellow">Stock bajo</Badge>
        : <Badge variant="green">Normal</Badge>,
    },
  ]

  const activeFilters = [search, bodegaId, categoriaId, productoId, soloStockBajo].filter(Boolean).length

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Stock / Existencias</h1>
          <p className="text-sm text-[#5F6B7A]">Inventario disponible por bodega</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Exportar Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filtros */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={search}
              onChange={v => { setSearch(v); reset() }}
              placeholder="Buscar producto…"
              className="w-full sm:w-56"
            />
            <ComboBox
              value={bodegaId}
              onChange={v => { setBodegaId(v); reset() }}
              options={[
                { value: '', label: 'Todas las bodegas' },
                ...(bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []),
              ]}
              placeholder="Todas las bodegas"
              triggerClassName="text-sm py-2 min-w-[160px]"
            />
            <ComboBox
              value={categoriaId}
              onChange={v => { setCategoriaId(v); reset() }}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...(categorias?.map(c => ({ value: c.id, label: c.nombre })) ?? []),
              ]}
              placeholder="Todas las categorías"
              triggerClassName="text-sm py-2 min-w-[180px]"
            />
            <ComboBox
              value={productoId}
              onChange={v => { setProductoId(v); reset() }}
              options={[
                { value: '', label: 'Todos los productos' },
                ...(productos?.map(p => ({ value: p.id, label: p.nombre })) ?? []),
              ]}
              placeholder="Todos los productos"
              triggerClassName="text-sm py-2 min-w-[180px]"
            />
            <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={soloStockBajo}
                onChange={e => { setSoloStockBajo(e.target.checked); reset() }}
                className="rounded accent-[#0E78D8]"
              />
              Solo stock bajo
            </label>
            {activeFilters > 0 && (
              <button
                onClick={() => { setSearch(''); setBodegaId(''); setCategoriaId(''); setProductoId(''); setSoloStockBajo(false); setPage(1) }}
                className="text-xs text-[#0E78D8] hover:underline font-semibold"
              >
                Limpiar filtros ({activeFilters})
              </button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          error={isError ? 'Error al cargar las existencias.' : undefined}
          emptyMessage="No hay existencias con esos filtros."
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
