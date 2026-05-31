import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saRolesApi } from '@/api/superAdmin'
import { Table, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { getAxiosError } from '@/lib/utils'
import type { RolAdmin } from '@/types'

const schema = z.object({
  nombre:      z.string().min(1, 'Requerido').max(100),
  descripcion: z.string().max(255).optional(),
})
type FormValues = z.infer<typeof schema>

export default function RolesAdminPage() {
  const qc = useQueryClient()
  const [modal, setModal]   = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<RolAdmin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RolAdmin | null>(null)
  const [error, setError]   = useState('')

  const { data: roles, isLoading } = useQuery({
    queryKey: ['sa-roles'],
    queryFn:  () => saRolesApi.list().then(r => r.data.data),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-roles'] })

  const createMut = useMutation({
    mutationFn: saRolesApi.create,
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormValues }) => saRolesApi.update(id, data),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: saRolesApi.remove,
    onSuccess:  () => { invalidate(); setDeleteTarget(null) },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const openCreate = () => {
    reset({ nombre: '', descripcion: '' })
    setError('')
    setModal('create')
  }

  const openEdit = (r: RolAdmin) => {
    setSelected(r)
    reset({ nombre: r.nombre, descripcion: r.descripcion ?? '' })
    setError('')
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setSelected(null); setError('') }

  const onSubmit = async (values: FormValues) => {
    if (modal === 'create') await createMut.mutateAsync(values)
    else if (selected)      await updateMut.mutateAsync({ id: selected.id, data: values })
  }

  const columns: Column<RolAdmin>[] = [
    {
      key: 'nombre', header: 'Nombre',
      cell: r => <span className="font-semibold text-[#072B5A]">{r.nombre}</span>,
    },
    {
      key: 'descripcion', header: 'Descripción',
      cell: r => <span className="text-sm text-gray-500">{r.descripcion || '—'}</span>,
    },
    {
      key: 'asignaciones', header: 'En uso', align: 'center', width: '90px',
      cell: r => (
        <span className={`text-sm font-medium rounded-full px-2.5 py-0.5 ${r.asignaciones > 0 ? 'text-blue-700 bg-blue-50' : 'text-gray-400 bg-gray-100'}`}>
          {r.asignaciones}
        </span>
      ),
    },
    {
      key: 'acciones', header: 'Acciones', align: 'right', width: '90px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Editar">
            <Pencil size={15} />
          </button>
          <button
            onClick={() => { setError(''); setDeleteTarget(r) }}
            disabled={r.asignaciones > 0}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={r.asignaciones > 0 ? 'En uso — no se puede eliminar' : 'Eliminar'}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Roles</h1>
          <p className="text-sm text-[#5F6B7A]">Roles disponibles para asignar a usuarios en cada empresa</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo rol</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table columns={columns} data={roles ?? []} loading={isLoading} emptyMessage="No hay roles registrados." />
      </div>

      {/* Modal crear/editar */}
      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nuevo rol' : 'Editar rol'} size="sm">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />
          <Input label="Descripción" {...register('descripcion')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar eliminación */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar rol" size="sm">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <p className="text-sm text-gray-600 mb-5">
          ¿Eliminar el rol <span className="font-semibold text-[#072B5A]">{deleteTarget?.nombre}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
