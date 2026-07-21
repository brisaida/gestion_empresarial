import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, AlertTriangle, ImagePlus, X, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { productosApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'
import { useCrud } from '@/hooks/useCrud'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { Producto } from '@/types'

export default function ProductosPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const empresaId: number = state.empresaActiva?.id ?? 0

  const crud = useCrud<Producto>(productosApi, { queryKey: 'productos', empresaId })

  const [deleteId, setDeleteId]             = useState<number | null>(null)
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set())
  const [deleteMasivoOpen, setDeleteMasivoOpen] = useState(false)
  const [masivoError, setMasivoError]       = useState('')

  // Importar Excel
  const [importModal,  setImportModal]  = useState(false)
  const [importFile,   setImportFile]   = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ creados: number; omitidos: number; errores: { fila: number; error: string }[]; sin_bodega: boolean } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Limpiar selección al cambiar de página
  useEffect(() => { setSelectedIds(new Set()) }, [crud.meta.current_page])

  const eliminarMasivo = useMutation({
    mutationFn: (ids: number[]) => productosApi.eliminarMasivo(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productos'] })
      setSelectedIds(new Set())
      setDeleteMasivoOpen(false)
      setMasivoError('')
    },
    onError: (err) => setMasivoError(getAxiosError(err)),
  })

  const importar = useMutation({
    mutationFn: (file: File) => productosApi.importar(empresaId, file),
    onSuccess:  (res) => { setImportResult(res.data.data); qc.invalidateQueries({ queryKey: ['productos'] }) },
    onError:    (err) => setImportResult({ creados: 0, omitidos: 0, sin_bodega: false, errores: [{ fila: 0, error: getAxiosError(err) }] }),
  })

  const allSelected = crud.data.length > 0 && crud.data.every(p => selectedIds.has(p.id))
  const someSelected = crud.data.some(p => selectedIds.has(p.id))

  const toggleAll = (checked: boolean) =>
    setSelectedIds(checked ? new Set(crud.data.map(p => p.id)) : new Set())

  const toggleOne = (id: number, checked: boolean) =>
    setSelectedIds(prev => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s })

  const columns: Column<Producto>[] = [
    {
      key: 'select',
      width: '44px',
      headerStyle: { paddingLeft: '16px', paddingRight: '0' },
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
          onChange={e => toggleAll(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 accent-[#0E78D8] cursor-pointer"
          aria-label="Seleccionar todos"
        />
      ),
      cell: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={e => toggleOne(r.id, e.target.checked)}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 accent-[#0E78D8] cursor-pointer"
          aria-label={`Seleccionar ${r.nombre}`}
        />
      ),
    },
    {
      key: 'imagen', header: '', width: '48px',
      cell: (r) => r.imagen_url ? (
        <img src={r.imagen_url} alt={r.nombre} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shadow-sm" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#F4F7FA] border border-gray-100 flex items-center justify-center">
          <ImagePlus size={14} className="text-gray-300" />
        </div>
      ),
    },
    {
      key: 'nombre', header: 'Producto',
      cell: (r) => <p className="font-medium text-[#072B5A]">{r.nombre}</p>,
    },
    {
      key: 'categorias', header: 'Categorías',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.categorias ?? []).length === 0
            ? <span className="text-xs text-gray-300">—</span>
            : (r.categorias ?? []).map(c => (
                <span key={c.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0E78D8]/8 text-[#0E78D8] border border-[#0E78D8]/15">
                  {c.nombre}
                </span>
              ))
          }
        </div>
      ),
    },
    { key: 'codigo',       header: 'Código',       cell: (r) => <span className="font-mono text-xs text-gray-400">{r.codigo ?? '—'}</span>, width: '90px' },
    { key: 'costo',        header: 'Costo',         cell: (r) => <span className="text-[#5F6B7A]">{formatCurrency(r.costo)}</span>, align: 'right' },
    { key: 'precio_venta', header: 'Precio Venta',  cell: (r) => <span className="font-semibold text-[#072B5A]">{formatCurrency(r.precio_venta)}</span>, align: 'right' },
    {
      key: 'stock', header: 'Stock', align: 'right',
      cell: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          {r.stock_total !== undefined && r.stock_total <= r.stock_minimo && r.stock_minimo > 0 && (
            <AlertTriangle size={13} className="text-amber-500" />
          )}
          <span className={r.stock_total !== undefined && r.stock_total <= r.stock_minimo && r.stock_minimo > 0 ? 'text-amber-600 font-medium' : 'text-[#5F6B7A]'}>
            {r.stock_total !== undefined ? formatNumber(r.stock_total, 2) : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'tipo', header: 'Tipo', align: 'center', width: '110px',
      cell: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
          r.tipo === 'ingrediente'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-[#0E78D8]/8 text-[#0E78D8] border border-[#0E78D8]/20'
        }`}>
          {r.tipo === 'ingrediente' ? 'Ingrediente' : 'Venta'}
        </span>
      ),
    },
    { key: 'activo', header: 'Estado', cell: (r) => <StatusBadge activo={r.activo} />, align: 'center', width: '90px' },
    {
      key: 'acciones', header: '', align: 'right', width: '80px',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => navigate(`/productos/${r.id}/editar`)} className="p-1.5 rounded text-gray-400 hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Productos</h1>
          <p className="text-sm text-[#5F6B7A]">Catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Upload size={15} />} onClick={() => { setImportFile(null); setImportResult(null); setImportModal(true) }}>Importar Excel</Button>
          <Button icon={<Plus size={16} />} onClick={() => navigate('/productos/nuevo')}>Nuevo producto</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={crud.search} onChange={(v) => { crud.setSearch(v); crud.setPage(1) }} placeholder="Buscar por nombre, código..." className="max-w-sm" />
        </div>

        {/* Barra de selección masiva */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0E78D8]/5 border-b border-[#0E78D8]/20">
            <span className="text-sm font-medium text-[#0E78D8]">
              {selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-[#5F6B7A] hover:text-[#072B5A] font-medium transition-colors"
              >
                Deseleccionar
              </button>
              <Button
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => { setMasivoError(''); setDeleteMasivoOpen(true) }}
              >
                Eliminar {selectedIds.size > 1 ? `${selectedIds.size} productos` : 'producto'}
              </Button>
            </div>
          </div>
        )}

        <Table columns={columns} data={crud.data} loading={crud.loading} error={crud.isError ? 'Error al cargar los productos.' : undefined} emptyMessage="No hay productos registrados." />
        <Pagination currentPage={crud.meta.current_page} lastPage={crud.meta.last_page} total={crud.meta.total} onPage={crud.setPage} />
      </div>

      {/* Modal eliminar */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Eliminar producto" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-6">¿Eliminar este producto? Solo es posible si no tiene stock en inventario.</p>
        {crud.error && <p className="mb-4 text-sm text-red-600">{crud.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={crud.remove.isPending} onClick={async () => { await crud.remove.mutateAsync(deleteId!); setDeleteId(null) }}>Eliminar</Button>
        </div>
      </Modal>

      {/* Modal eliminar masivo */}
      <Modal open={deleteMasivoOpen} onClose={() => setDeleteMasivoOpen(false)} title="Eliminar productos" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-2">
          ¿Eliminar <strong>{selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''}</strong>? Solo se eliminarán los que no tengan stock en inventario.
        </p>
        {masivoError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{masivoError}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setDeleteMasivoOpen(false)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={eliminarMasivo.isPending}
            onClick={() => eliminarMasivo.mutate([...selectedIds])}
          >
            Eliminar
          </Button>
        </div>
      </Modal>

      {/* Modal importar Excel */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Importar productos desde Excel" size="sm">
        <div className="space-y-4">
          {!importResult ? (
            <>
              <div className="bg-[#F4F7FA] rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-[#072B5A]">Paso 1 — Descarga la plantilla</p>
                <p className="text-xs text-[#5F6B7A]">Completa el Excel con tus productos y luego súbelo aquí.</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E78D8] hover:underline"
                  onClick={async () => {
                    const token = localStorage.getItem('token') ?? ''
                    const res = await fetch(productosApi.plantillaUrl(empresaId), { headers: { Authorization: `Bearer ${token}` } })
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.xlsx'; a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download size={13} /> Descargar plantilla_productos.xlsx
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#072B5A] mb-2">Paso 2 — Sube tu archivo</p>
                <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                {importFile ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-emerald-800 font-medium truncate">{importFile.name}</span>
                    <button onClick={() => setImportFile(null)} className="ml-2 text-emerald-600 hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => importRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-[#5F6B7A] hover:border-[#0E78D8]/50 hover:bg-[#0E78D8]/5 transition-all"
                  >
                    <Upload size={20} className="mx-auto mb-1 text-gray-300" />
                    Haz clic para seleccionar un archivo .xlsx
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" onClick={() => setImportModal(false)} className="flex-1">Cancelar</Button>
                <Button disabled={!importFile} loading={importar.isPending} onClick={() => importFile && importar.mutate(importFile)} className="flex-1">Importar</Button>
              </div>
            </>
          ) : (
            <>
              <div className={`rounded-lg px-4 py-3 flex items-start gap-3 ${importResult.creados > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <CheckCircle2 size={18} className={`shrink-0 mt-0.5 ${importResult.creados > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div className="text-sm space-y-0.5">
                  <p className="font-semibold text-emerald-800">{importResult.creados} producto(s) importado(s) correctamente.</p>
                  {importResult.omitidos > 0 && (
                    <p className="text-emerald-700">{importResult.omitidos} omitido(s) por nombre duplicado.</p>
                  )}
                  {importResult.sin_bodega && (
                    <p className="text-amber-700 mt-1">No hay bodega predeterminada: el stock inicial no se registró. Configúrala en Catálogos → Bodegas.</p>
                  )}
                </div>
              </div>
              {importResult.errores.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><AlertCircle size={13} /> {importResult.errores.length} fila(s) con error:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errores.map((e, i) => (
                      <div key={i} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1 text-red-700">
                        {e.fila > 0 ? `Fila ${e.fila}: ` : ''}{e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={() => setImportModal(false)} className="w-full">Cerrar</Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
