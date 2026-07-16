import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, Download, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { categoriasApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'
import { useCrud } from '@/hooks/useCrud'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import SearchBar from '@/components/ui/SearchBar'
import type { Categoria } from '@/types'

const schema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  activo:      z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export default function CategoriasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()
  const crud = useCrud(categoriasApi, { queryKey: 'categorias', empresaId })

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Categoria | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [importModal,  setImportModal]  = useState(false)
  const [importFile,   setImportFile]   = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ creados: number; omitidas: number; errores: { fila: number; error: string }[] } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const importar = useMutation({
    mutationFn: (file: File) => categoriasApi.importar(empresaId, file),
    onSuccess:  (res) => { setImportResult(res.data.data); qc.invalidateQueries({ queryKey: ['categorias'] }) },
    onError:    (err) => setImportResult({ creados: 0, omitidas: 0, errores: [{ fila: 0, error: getAxiosError(err) }] }),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { reset({ nombre: '', descripcion: '', activo: true }); setModal('create') }
  const openEdit = (c: Categoria) => { setSelected(c); reset({ nombre: c.nombre, descripcion: c.descripcion ?? '', activo: c.activo }); setModal('edit') }
  const closeModal = () => { setModal(null); setSelected(null); crud.setError('') }

  const onSubmit = async (values: FormValues) => {
    if (modal === 'create') {
      await crud.create.mutateAsync({ ...values, empresa_id: empresaId })
    } else if (selected) {
      await crud.update.mutateAsync({ id: selected.id, data: values })
    }
    closeModal()
  }

  const confirmDelete = async () => {
    if (deleteId) { await crud.remove.mutateAsync(deleteId); setDeleteId(null) }
  }

  const columns: Column<Categoria>[] = [
    { key: 'nombre',      header: 'Nombre',      cell: (r) => <span className="font-medium text-[#072B5A]">{r.nombre}</span> },
    { key: 'descripcion', header: 'Descripción',  cell: (r) => <span className="text-gray-500">{r.descripcion ?? '—'}</span> },
    { key: 'activo',      header: 'Estado',       cell: (r) => <StatusBadge activo={r.activo} />, align: 'center', width: '100px' },
    {
      key: 'acciones', header: 'Acciones', align: 'right', width: '100px',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-gray-400 hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Categorías</h1>
          <p className="text-sm text-[#5F6B7A]">Clasificación de productos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Upload size={15} />} onClick={() => { setImportFile(null); setImportResult(null); setImportModal(true) }}>Importar Excel</Button>
          <Button icon={<Plus size={16} />} onClick={openCreate}>Nueva categoría</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={crud.search} onChange={(v) => { crud.setSearch(v); crud.setPage(1) }} placeholder="Buscar categorías..." className="max-w-xs" />
        </div>

        <Table columns={columns} data={crud.data} loading={crud.loading} emptyMessage="No hay categorías registradas." />
        <Pagination currentPage={crud.meta.current_page} lastPage={crud.meta.last_page} total={crud.meta.total} onPage={crud.setPage} />
      </div>

      {/* Modal crear/editar */}
      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}>
        {crud.error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{crud.error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />
          <Input label="Descripción" {...register('descripcion')} />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('activo')} className="rounded" />
            Activo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Eliminar categoría" size="sm">
        <p className="text-sm text-gray-600 mb-6">¿Estás seguro de eliminar esta categoría? Esta acción no se puede deshacer.</p>
        {crud.error && <p className="mb-4 text-sm text-red-600">{crud.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={crud.remove.isPending} onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Modal>

      {/* Modal importar Excel */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Importar categorías desde Excel" size="sm">
        <div className="space-y-4">
          {!importResult ? (
            <>
              <div className="bg-[#F4F7FA] rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-[#072B5A]">Paso 1 — Descarga la plantilla</p>
                <p className="text-xs text-[#5F6B7A]">Completa el Excel con tus categorías (nombre, descripción, activo) y luego súbelo.</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E78D8] hover:underline"
                  onClick={async () => {
                    const token = localStorage.getItem('token') ?? ''
                    const res = await fetch(categoriasApi.plantillaUrl(), { headers: { Authorization: `Bearer ${token}` } })
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_categorias.xlsx'; a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download size={13} /> Descargar plantilla_categorias.xlsx
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
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-800">{importResult.creados} categoría(s) importada(s) correctamente.</p>
                  {importResult.omitidas > 0 && (
                    <p className="text-emerald-700 mt-0.5">{importResult.omitidas} omitida(s) por nombre duplicado.</p>
                  )}
                </div>
              </div>
              {importResult.errores.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><AlertCircle size={13} /> {importResult.errores.length} fila(s) con error:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errores.map((e, i) => (
                      <div key={i} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1 text-red-700">
                        {e.fila > 0 && <span className="font-semibold">Fila {e.fila}: </span>}{e.error}
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
