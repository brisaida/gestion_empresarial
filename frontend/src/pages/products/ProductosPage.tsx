import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, ImagePlus, X } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { productosApi, categoriasApi, marcasApi, unidadesApi } from '@/api/recursos'
import { useCrud } from '@/hooks/useCrud'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { Producto } from '@/types'

const schema = z.object({
  nombre:             z.string().min(1, 'El nombre es requerido'),
  codigo:             z.string().optional(),
  codigo_barra:       z.string().optional(),
  descripcion:        z.string().optional(),
  categoria_id:       z.string().optional(),
  marca_id:           z.string().optional(),
  unidad_medida_id:   z.string().optional(),
  costo:              z.coerce.number().min(0),
  precio_venta:       z.coerce.number().min(0),
  stock_minimo:       z.coerce.number().min(0).optional(),
  tamaño:             z.string().max(50).optional(),
  peso:               z.coerce.number().min(0).optional().or(z.literal('')),
  largo:              z.coerce.number().min(0).optional().or(z.literal('')),
  ancho:              z.coerce.number().min(0).optional().or(z.literal('')),
  alto:               z.coerce.number().min(0).optional().or(z.literal('')),
  maneja_lote:        z.boolean().optional(),
  maneja_vencimiento: z.boolean().optional(),
  maneja_serie:       z.boolean().optional(),
  activo:             z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export default function ProductosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const crud = useCrud(productosApi, { queryKey: 'productos', empresaId })
  const qc = useQueryClient()

  const [modal, setModal]       = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Producto | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Image state
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: cats }     = useQuery({ queryKey: ['cats-all', empresaId],     queryFn: () => categoriasApi.list({ empresa_id: empresaId, per_page: 100, solo_activos: true }).then((r) => r.data.data), enabled: empresaId > 0 })
  const { data: marcas }   = useQuery({ queryKey: ['marcas-all', empresaId],   queryFn: () => marcasApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data), enabled: empresaId > 0 })
  const { data: unidades } = useQuery({ queryKey: ['unidades-all', empresaId], queryFn: () => unidadesApi.list({ empresa_id: empresaId, per_page: 100 }).then((r) => r.data.data), enabled: empresaId > 0 })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
  })

  const prepareData = (v: FormValues) => ({
    ...v,
    empresa_id:       empresaId,
    categoria_id:     v.categoria_id ? Number(v.categoria_id) : null,
    marca_id:         v.marca_id ? Number(v.marca_id) : null,
    unidad_medida_id: v.unidad_medida_id ? Number(v.unidad_medida_id) : null,
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async (v: FormValues) => {
    let productoId: number

    if (modal === 'create') {
      const res = await crud.create.mutateAsync(prepareData(v))
      productoId = (res as { data: { data: Producto } }).data.data.id
    } else {
      await crud.update.mutateAsync({ id: selected!.id, data: prepareData(v) })
      productoId = selected!.id
    }

    // Upload image if selected
    if (imageFile) {
      setUploadingImg(true)
      try {
        await productosApi.uploadImagen(productoId, imageFile)
        qc.invalidateQueries({ queryKey: ['productos'] })
      } finally {
        setUploadingImg(false)
      }
    }

    closeModal()
  }

  const openCreate = () => {
    reset({ nombre: '', costo: 0, precio_venta: 0, stock_minimo: 0, activo: true })
    clearImage()
    setModal('create')
  }

  const openEdit = (p: Producto) => {
    setSelected(p)
    reset({
      nombre: p.nombre, codigo: p.codigo ?? '', codigo_barra: p.codigo_barra ?? '',
      descripcion: p.descripcion ?? '',
      categoria_id: String(p.categoria_id ?? ''), marca_id: String(p.marca_id ?? ''),
      unidad_medida_id: String(p.unidad_medida_id ?? ''),
      costo: p.costo, precio_venta: p.precio_venta, stock_minimo: p.stock_minimo,
      tamaño: p.tamaño ?? '', peso: p.peso ?? '', largo: p.largo ?? '', ancho: p.ancho ?? '', alto: p.alto ?? '',
      maneja_lote: p.maneja_lote, maneja_vencimiento: p.maneja_vencimiento,
      maneja_serie: p.maneja_serie, activo: p.activo,
    })
    // Show existing image as preview
    setImageFile(null)
    setImagePreview(p.imagen_url ?? null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setSelected(null)
    clearImage()
    crud.setError('')
  }

  const columns: Column<Producto>[] = [
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
      cell: (r) => (
        <div>
          <p className="font-medium text-[#072B5A]">{r.nombre}</p>
          {r.categoria && <p className="text-xs text-gray-400">{r.categoria.nombre}</p>}
        </div>
      ),
    },
    { key: 'codigo',        header: 'Código',       cell: (r) => <span className="font-mono text-xs text-gray-400">{r.codigo ?? '—'}</span>, width: '90px' },
    { key: 'costo',         header: 'Costo',        cell: (r) => <span className="text-[#5F6B7A]">{formatCurrency(r.costo)}</span>, align: 'right' },
    { key: 'precio_venta',  header: 'Precio Venta', cell: (r) => <span className="font-semibold text-[#072B5A]">{formatCurrency(r.precio_venta)}</span>, align: 'right' },
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
    { key: 'activo', header: 'Estado', cell: (r) => <StatusBadge activo={r.activo} />, align: 'center', width: '90px' },
    {
      key: 'acciones', header: '', align: 'right', width: '80px',
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
          <h1 className="text-xl font-bold text-[#072B5A]">Productos</h1>
          <p className="text-sm text-[#5F6B7A]">Catálogo de productos</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo producto</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={crud.search} onChange={(v) => { crud.setSearch(v); crud.setPage(1) }} placeholder="Buscar por nombre, código..." className="max-w-sm" />
        </div>
        <Table columns={columns} data={crud.data} loading={crud.loading} emptyMessage="No hay productos registrados." />
        <Pagination currentPage={crud.meta.current_page} lastPage={crud.meta.last_page} total={crud.meta.total} onPage={crud.setPage} />
      </div>

      {/* Modal crear/editar */}
      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nuevo producto' : 'Editar producto'} size="lg">
        {crud.error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{crud.error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Imagen */}
          <div>
            <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide mb-2">Foto del producto</p>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="relative shrink-0">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="w-24 h-24 rounded-xl object-cover border border-gray-200 shadow-sm" />
                    {imageFile && (
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-[#F4F7FA] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
                    <ImagePlus size={22} className="text-gray-300" />
                    <span className="text-[10px] text-gray-300 font-medium">Sin foto</span>
                  </div>
                )}
              </div>

              {/* Upload button */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                  id="imagen-input"
                />
                <label
                  htmlFor="imagen-input"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] cursor-pointer transition-all"
                >
                  <ImagePlus size={15} />
                  {imagePreview ? 'Cambiar foto' : 'Subir foto'}
                </label>
                <p className="text-xs text-gray-400">JPG, PNG o WebP · Máx. 2 MB</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />
            </div>
            <Input label="Código interno" {...register('codigo')} placeholder="P-001" />
            <Input label="Código de barras" {...register('codigo_barra')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select label="Categoría" options={cats?.map((c) => ({ value: c.id, label: c.nombre })) ?? []} placeholder="Sin categoría" {...register('categoria_id')} />
            <Select label="Marca" options={marcas?.map((m) => ({ value: m.id, label: m.nombre })) ?? []} placeholder="Sin marca" {...register('marca_id')} />
            <Select label="Unidad de medida" options={unidades?.map((u) => ({ value: u.id, label: `${u.nombre} (${u.abreviatura})` })) ?? []} placeholder="Sin unidad" {...register('unidad_medida_id')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Costo *" type="number" step="0.01" error={errors.costo?.message} {...register('costo')} />
            <Input label="Precio de venta *" type="number" step="0.01" error={errors.precio_venta?.message} {...register('precio_venta')} />
            <Input label="Stock mínimo" type="number" step="0.01" {...register('stock_minimo')} />
          </div>

          <div>
            <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide mb-2">Medidas físicas <span className="normal-case font-normal text-gray-400">(opcional)</span></p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Input label="Talla / Tamaño" placeholder="S, M, L, XL, 42…" {...register('tamaño')} />
              <Input label="Peso (kg)" type="number" step="0.001" placeholder="0.500" {...register('peso')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Largo (cm)" type="number" step="0.01" placeholder="0.00" {...register('largo')} />
              <Input label="Ancho (cm)" type="number" step="0.01" placeholder="0.00" {...register('ancho')} />
              <Input label="Alto (cm)"  type="number" step="0.01" placeholder="0.00" {...register('alto')} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide mb-2">Opciones de rastreo</p>
            <div className="flex gap-6">
              {[['maneja_lote','Maneja lote'],['maneja_vencimiento','Maneja vencimiento'],['maneja_serie','Maneja serie']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
                  <input type="checkbox" {...register(k as keyof FormValues)} className="rounded accent-[#0E78D8]" />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
            <input type="checkbox" {...register('activo')} className="rounded accent-[#0E78D8]" />
            Activo
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting || uploadingImg}>
              {isSubmitting || uploadingImg
                ? uploadingImg ? 'Subiendo imagen...' : 'Guardando...'
                : modal === 'create' ? 'Crear producto' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Eliminar producto" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-6">¿Eliminar este producto? Solo es posible si no tiene stock en inventario.</p>
        {crud.error && <p className="mb-4 text-sm text-red-600">{crud.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={crud.remove.isPending} onClick={async () => { await crud.remove.mutateAsync(deleteId!); setDeleteId(null) }}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
