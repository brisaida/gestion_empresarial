import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/stores/authStore'
import { proveedoresApi } from '@/api/recursos'
import { useCrud } from '@/hooks/useCrud'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import SearchBar from '@/components/ui/SearchBar'
import type { Proveedor } from '@/types'

const schema = z.object({
  nombre:    z.string().min(1, 'El nombre es requerido'),
  rtn:       z.string().optional(),
  correo:    z.string().email('Correo inválido').optional().or(z.literal('')),
  telefono:  z.string().optional(),
  direccion: z.string().optional(),
  activo:    z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export default function ProveedoresPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const crud = useCrud(proveedoresApi, { queryKey: 'proveedores', empresaId })

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Proveedor | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { reset({ nombre: '', activo: true }); setModal('create') }
  const openEdit = (p: Proveedor) => { setSelected(p); reset({ nombre: p.nombre, rtn: p.rtn ?? '', correo: p.correo ?? '', telefono: p.telefono ?? '', direccion: p.direccion ?? '', activo: p.activo }); setModal('edit') }
  const closeModal = () => { setModal(null); setSelected(null); crud.setError('') }

  const onSubmit = async (values: FormValues) => {
    if (modal === 'create') await crud.create.mutateAsync({ ...values, empresa_id: empresaId })
    else if (selected) await crud.update.mutateAsync({ id: selected.id, data: values })
    closeModal()
  }

  const columns: Column<Proveedor>[] = [
    { key: 'nombre',   header: 'Proveedor', cell: (r) => <span className="font-medium text-[#072B5A]">{r.nombre}</span> },
    { key: 'rtn',      header: 'RTN',       cell: (r) => <span className="text-gray-500">{r.rtn ?? '—'}</span> },
    { key: 'correo',   header: 'Correo',    cell: (r) => <span className="text-gray-500">{r.correo ?? '—'}</span> },
    { key: 'telefono', header: 'Teléfono',  cell: (r) => <span className="text-gray-500">{r.telefono ?? '—'}</span> },
    { key: 'activo',   header: 'Estado',    cell: (r) => <StatusBadge activo={r.activo} />, align: 'center', width: '90px' },
    {
      key: 'acciones', header: '', align: 'right', width: '80px',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-gray-400 hover:text-[#0E78D8] hover:bg-[#0E78D8]/8"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Proveedores</h1>
          <p className="text-sm text-gray-500">Gestión de proveedores</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo proveedor</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={crud.search} onChange={(v) => { crud.setSearch(v); crud.setPage(1) }} placeholder="Buscar proveedores..." className="max-w-xs" />
        </div>
        <Table columns={columns} data={crud.data} loading={crud.loading} />
        <Pagination currentPage={crud.meta.current_page} lastPage={crud.meta.last_page} total={crud.meta.total} onPage={crud.setPage} />
      </div>

      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}>
        {crud.error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{crud.error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} /></div>
            <Input label="RTN" {...register('rtn')} />
            <Input label="Teléfono" {...register('telefono')} />
            <Input label="Correo" type="email" error={errors.correo?.message} {...register('correo')} />
            <Input label="Dirección" {...register('direccion')} />
          </div>
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

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Eliminar proveedor" size="sm">
        <p className="text-sm text-gray-600 mb-6">¿Eliminar este proveedor? No se puede deshacer.</p>
        {crud.error && <p className="mb-4 text-sm text-red-600">{crud.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={crud.remove.isPending} onClick={async () => { await crud.remove.mutateAsync(deleteId!); setDeleteId(null) }}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
