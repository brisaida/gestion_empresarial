import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, CheckCircle, Download, Loader2 } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { existenciasApi, bodegasApi, categoriasApi, productosApi, movimientosApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import SearchBar from '@/components/ui/SearchBar'
import ComboBox from '@/components/ui/ComboBox'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatNumber } from '@/lib/utils'
import type { Existencia } from '@/types'

export default function ExistenciasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const queryClient = useQueryClient()

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [bodegaId, setBodegaId]     = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [exporting, setExporting]   = useState(false)

  // Traslado individual (sin bodega → bodega)
  const [trasladoItem, setTrasladoItem]       = useState<Existencia | null>(null)
  const [trasladoBodegaId, setTrasladoBodegaId] = useState('')
  const [trasladoCantidad, setTrasladoCantidad] = useState('')
  const [trasladoLoading, setTrasladoLoading]   = useState(false)
  const [trasladoError, setTrasladoError]       = useState<string | null>(null)

  // Traslado masivo (todos sin bodega → bodega)
  const [masivoBodegaId, setMasivoBodegaId]     = useState('')
  const [masivoOpen, setMasivoOpen]             = useState(false)
  const [masivoLoading, setMasivoLoading]       = useState(false)
  const [masivoError, setMasivoError]           = useState<string | null>(null)
  const [masivoProgress, setMasivoProgress]     = useState<{ done: number; total: number } | null>(null)

  const reset = () => { setPage(1) }

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const { data: categorias } = useQuery({
    queryKey: ['categorias', empresaId],
    queryFn:  () => categoriasApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  // Sin filtro solo_activos: productos inactivos pueden seguir teniendo stock sin asignar
  const { data: productos } = useQuery({
    queryKey: ['productos-all-incl-inactivos', empresaId],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, per_page: 500 }).then(r => r.data.data),
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

  const openTraslado = (item: Existencia) => {
    setTrasladoItem(item)
    setTrasladoBodegaId('')
    setTrasladoCantidad(String(item.cantidad_disponible))
    setTrasladoError(null)
  }

  const closeTraslado = () => {
    setTrasladoItem(null)
    setTrasladoBodegaId('')
    setTrasladoCantidad('')
    setTrasladoError(null)
  }

  const handleConfirmarTraslado = async () => {
    if (!trasladoItem || !trasladoBodegaId) return
    const cantNum = parseFloat(trasladoCantidad)
    if (!cantNum || cantNum <= 0) { setTrasladoError('Ingresá una cantidad válida.'); return }
    if (cantNum > trasladoItem.cantidad_disponible) {
      setTrasladoError(`Máximo disponible: ${trasladoItem.cantidad_disponible}`)
      return
    }
    setTrasladoLoading(true)
    setTrasladoError(null)
    const hoy = new Date().toISOString().slice(0, 10)
    const costoUnitario = productos?.find(p => p.id === trasladoItem.producto_id)?.costo ?? null
    const bodegaNombre  = bodegas?.find(b => String(b.id) === trasladoBodegaId)?.nombre ?? trasladoBodegaId
    try {
      // 1. Salida de bodega sin asignar (bodega_id = null)
      await movimientosApi.create({
        empresa_id:      empresaId,
        bodega_id:       null,
        tipo_movimiento: 'ajuste_negativo',
        fecha:           hoy,
        observaciones:   `Traslado a bodega ${bodegaNombre}`,
        detalles: [{
          producto_id:    trasladoItem.producto_id,
          cantidad:       cantNum,
          costo_unitario: costoUnitario,
        }],
      })
      // 2. Entrada a la bodega destino
      await movimientosApi.create({
        empresa_id:      empresaId,
        bodega_id:       Number(trasladoBodegaId),
        tipo_movimiento: 'ajuste_positivo',
        fecha:           hoy,
        observaciones:   `Traslado desde sin asignar`,
        detalles: [{
          producto_id:    trasladoItem.producto_id,
          cantidad:       cantNum,
          costo_unitario: costoUnitario,
        }],
      })
      // Invalidar existencias y productos para refrescar stock
      queryClient.invalidateQueries({ queryKey: ['existencias'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      closeTraslado()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTrasladoError(msg ?? 'Error al trasladar. Intentá de nuevo.')
    } finally {
      setTrasladoLoading(false)
    }
  }

  const columns: Column<Existencia>[] = [
    {
      key: 'producto', header: 'Producto',
      cell: r => (
        <div>
          <p className="font-semibold text-[var(--cs)]">{r.producto?.nombre ?? '—'}</p>
          {r.producto?.codigo && <p className="text-xs text-[#5F6B7A] font-mono">{r.producto.codigo}</p>}
        </div>
      ),
    },
    {
      key: 'bodega', header: 'Bodega',
      cell: r => r.bodega_id === null
        ? <span className="text-[#5F6B7A] italic text-xs">Sin asignar</span>
        : <span className="text-[#5F6B7A]">{r.bodega?.nombre ?? '—'}</span>,
    },
    {
      key: 'cantidad', header: 'Disponible', align: 'right',
      cell: r => (
        <div className="flex items-center justify-end gap-2">
          {r.producto?.stock_bajo
            ? <AlertTriangle size={14} className="text-amber-500" />
            : <CheckCircle   size={14} className="text-emerald-400" />}
          <span className={`font-bold ${r.producto?.stock_bajo ? 'text-amber-600' : 'text-[var(--cs)]'}`}>
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
    {
      key: 'acciones' as keyof Existencia, header: '', align: 'center', width: '60px',
      cell: r => r.bodega_id === null && (r.cantidad_disponible ?? 0) > 0
        ? (
          <button
            title="Trasladar a bodega"
            onClick={() => openTraslado(r)}
            className="p-1.5 rounded-lg text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors"
          >
            <ArrowRightLeft size={15} />
          </button>
        )
        : null,
    },
  ]

  const openMasivo = () => { setMasivoBodegaId(''); setMasivoError(null); setMasivoProgress(null); setMasivoOpen(true) }
  const closeMasivo = () => { if (masivoLoading) return; setMasivoOpen(false); setMasivoProgress(null); setMasivoError(null) }

  const handleConfirmarMasivo = async () => {
    if (!masivoBodegaId) return
    setMasivoLoading(true)
    setMasivoError(null)
    setMasivoProgress(null)
    try {
      // Traer todos los sin asignar con stock > 0
      const res  = await existenciasApi.list({ empresa_id: empresaId, sin_bodega: 1, per_page: 999 })
      const items = (res.data.data as Existencia[]).filter(r => (r.cantidad_disponible ?? 0) > 0)
      if (items.length === 0) { setMasivoError('No hay productos sin asignar con stock disponible.'); setMasivoLoading(false); return }

      const hoy         = new Date().toISOString().slice(0, 10)
      const bodegaNombre = bodegas?.find(b => String(b.id) === masivoBodegaId)?.nombre ?? masivoBodegaId
      setMasivoProgress({ done: 0, total: items.length })

      for (let i = 0; i < items.length; i++) {
        const item  = items[i]
        const costo = productos?.find(p => p.id === item.producto_id)?.costo ?? null
        await movimientosApi.create({
          empresa_id: empresaId, bodega_id: null,
          tipo_movimiento: 'ajuste_negativo', fecha: hoy,
          observaciones: `Traslado masivo a bodega ${bodegaNombre}`,
          detalles: [{ producto_id: item.producto_id, cantidad: item.cantidad_disponible, costo_unitario: costo }],
        })
        await movimientosApi.create({
          empresa_id: empresaId, bodega_id: Number(masivoBodegaId),
          tipo_movimiento: 'ajuste_positivo', fecha: hoy,
          observaciones: `Traslado masivo desde sin asignar`,
          detalles: [{ producto_id: item.producto_id, cantidad: item.cantidad_disponible, costo_unitario: costo }],
        })
        setMasivoProgress({ done: i + 1, total: items.length })
      }

      queryClient.invalidateQueries({ queryKey: ['existencias'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      closeMasivo()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setMasivoError(msg ?? 'Error al trasladar. Intentá de nuevo.')
    } finally {
      setMasivoLoading(false)
    }
  }

  const activeFilters = [search, bodegaId, categoriaId, productoId, soloStockBajo].filter(Boolean).length

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--cs)]">Stock / Existencias</h1>
          <p className="text-sm text-[#5F6B7A]">Inventario disponible por bodega</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openMasivo}
            title="Trasladar todos los productos sin bodega asignada"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ArrowRightLeft size={15} />
            Trasladar sin asignar
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Exportar Excel
          </button>
        </div>
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
                ...(productos?.map(p => ({
                  value: p.id,
                  label: p.nombre,
                  sublabel: p.codigo ?? undefined,
                  searchText: p.codigo ?? undefined,
                })) ?? []),
              ]}
              placeholder="Todos los productos"
              triggerClassName="text-sm py-2 min-w-[180px]"
            />
            <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={soloStockBajo}
                onChange={e => { setSoloStockBajo(e.target.checked); reset() }}
                className="rounded accent-[var(--cp)]"
              />
              Solo stock bajo
            </label>
            {activeFilters > 0 && (
              <button
                onClick={() => { setSearch(''); setBodegaId(''); setCategoriaId(''); setProductoId(''); setSoloStockBajo(false); setPage(1) }}
                className="text-xs text-[var(--cp)] hover:underline font-semibold"
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

      {/* Modal traslado */}
      <Modal
        open={!!trasladoItem}
        onClose={closeTraslado}
        title="Asignar a bodega"
        size="sm"
      >
        {trasladoItem && (
          <div className="space-y-4">
            <div className="bg-[#F4F7FA] rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-[var(--cs)]">{trasladoItem.producto?.nombre}</p>
              {trasladoItem.producto?.codigo && (
                <p className="text-xs text-[#5F6B7A] font-mono">{trasladoItem.producto.codigo}</p>
              )}
              <p className="text-xs text-[#5F6B7A] mt-1">
                Disponible sin asignar: <strong className="text-[var(--cs)]">{formatNumber(trasladoItem.cantidad_disponible)}</strong>
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Bodega destino *</p>
              <ComboBox
                value={trasladoBodegaId}
                onChange={setTrasladoBodegaId}
                options={bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []}
                placeholder="— Seleccioná una bodega —"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Cantidad *</p>
              <input
                type="number"
                step="any"
                min="0.0001"
                max={trasladoItem.cantidad_disponible}
                value={trasladoCantidad}
                onChange={e => setTrasladoCantidad(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Máx. {formatNumber(trasladoItem.cantidad_disponible)}</p>
            </div>

            {trasladoError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {trasladoError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <Button variant="secondary" onClick={closeTraslado} disabled={trasladoLoading}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarTraslado}
                disabled={trasladoLoading || !trasladoBodegaId}
                className="flex items-center gap-2"
              >
                {trasladoLoading && <Loader2 size={14} className="animate-spin" />}
                Confirmar traslado
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal traslado masivo */}
      <Modal open={masivoOpen} onClose={closeMasivo} title="Trasladar todo sin asignar" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#5F6B7A]">
            Todos los productos con stock disponible en <strong>Sin asignar</strong> se moverán a la bodega que elijas.
            Se creará un ajuste negativo y uno positivo por cada producto.
          </p>

          <div>
            <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">Bodega destino *</p>
            <ComboBox
              value={masivoBodegaId}
              onChange={setMasivoBodegaId}
              options={bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []}
              placeholder="— Seleccioná una bodega —"
            />
          </div>

          {masivoProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#5F6B7A]">
                <span>Trasladando productos…</span>
                <span className="font-semibold">{masivoProgress.done} / {masivoProgress.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${(masivoProgress.done / masivoProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {masivoError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {masivoError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <Button variant="secondary" onClick={closeMasivo} disabled={masivoLoading}>Cancelar</Button>
            <Button
              onClick={handleConfirmarMasivo}
              disabled={masivoLoading || !masivoBodegaId}
              className="flex items-center gap-2"
            >
              {masivoLoading && <Loader2 size={14} className="animate-spin" />}
              {masivoLoading ? 'Trasladando…' : 'Confirmar traslado masivo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
