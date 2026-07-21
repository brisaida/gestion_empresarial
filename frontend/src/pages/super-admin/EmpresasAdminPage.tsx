import { useState } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import ComboBox from '@/components/ui/ComboBox'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saEmpresasApi } from '@/api/superAdmin'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import SearchBar from '@/components/ui/SearchBar'
import { getAxiosError } from '@/lib/utils'
import type { EmpresaAdmin, Rubro } from '@/types'

const RUBROS: { value: Rubro; label: string }[] = [
  { value: 'tienda',        label: 'Tienda / Retail' },
  { value: 'distribuidora', label: 'Distribuidora / Mayorista' },
  { value: 'farmacia',      label: 'Farmacia / Salud' },
  { value: 'ferreteria',    label: 'Ferretería / Construcción' },
  { value: 'restaurante',   label: 'Restaurante / Cafetería' },
]

const schema = z.object({
  nombre:       z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(255),
  nombre_legal: z.string().max(255).optional().or(z.literal('')),
  rtn:          z.string().max(20, 'El RTN no puede tener más de 20 caracteres').optional().or(z.literal('')),
  correo:       z.string().email('Ingresa un correo electrónico válido').optional().or(z.literal('')),
  telefono:     z.string().max(30, 'El teléfono es demasiado largo').optional().or(z.literal('')),
  direccion:    z.string().max(500).optional().or(z.literal('')),
  rubro:        z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function EmpresasAdminPage() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<EmpresaAdmin | null>(null)
  const [error, setError]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sa-empresas', page, search],
    queryFn:  () => saEmpresasApi.list({ page, search: search || undefined, per_page: 15 }).then(r => r.data),
  })

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-empresas'] })

  const createMut = useMutation({
    mutationFn: saEmpresasApi.create,
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormValues }) => saEmpresasApi.update(id, data),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const toggleMut = useMutation({
    mutationFn: saEmpresasApi.toggle,
    onSuccess:  invalidate,
  })

  const openCreate = () => {
    reset({ nombre: '', nombre_legal: '', rtn: '', correo: '', telefono: '', direccion: '', rubro: '' })
    setError('')
    setModal('create')
  }

  const openEdit = (e: EmpresaAdmin) => {
    setSelected(e)
    reset({ nombre: e.nombre, nombre_legal: e.nombre_legal ?? '', rtn: e.rtn ?? '', correo: e.correo ?? '', telefono: e.telefono ?? '', direccion: e.direccion ?? '', rubro: e.rubro ?? '' })
    setError('')
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setSelected(null); setError('') }

  const onSubmit = async (values: FormValues) => {
    if (modal === 'create') await createMut.mutateAsync(values)
    else if (selected)      await updateMut.mutateAsync({ id: selected.id, data: values })
  }

  const columns: Column<EmpresaAdmin>[] = [
    { key: 'nombre',       header: 'Nombre',          cell: r => <span className="font-semibold text-[#072B5A]">{r.nombre}</span> },
    { key: 'nombre_legal', header: 'Razón social',     cell: r => <span className="text-gray-500 text-sm">{r.nombre_legal ?? '—'}</span> },
    { key: 'rtn',          header: 'RTN',              cell: r => <span className="text-gray-500 text-sm">{r.rtn ?? '—'}</span> },
    { key: 'rubro', header: 'Rubro', width: '160px',
      cell: r => r.rubro
        ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#0E78D8]/10 text-[#0E78D8]">
            {RUBROS.find(x => x.value === r.rubro)?.label ?? r.rubro}
          </span>
        : <span className="text-gray-400 text-sm">—</span>
    },
    { key: 'usuarios_count', header: 'Usuarios', align: 'center', width: '90px',
      cell: r => <span className="text-sm font-medium text-purple-700 bg-purple-50 rounded-full px-2.5 py-0.5">{r.usuarios_count}</span> },
    { key: 'activo', header: 'Estado', align: 'center', width: '90px', cell: r => <StatusBadge activo={r.activo} /> },
    {
      key: 'acciones', header: 'Acciones', align: 'right', width: '100px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Editar">
            <Pencil size={15} />
          </button>
          <button onClick={() => toggleMut.mutate(r.id)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title={r.activo ? 'Desactivar' : 'Activar'}>
            {r.activo ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Empresas</h1>
          <p className="text-sm text-[#5F6B7A]">Gestión de empresas registradas en la plataforma</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nueva empresa</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Buscar empresas..." className="max-w-xs" />
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay empresas registradas." />
        <Pagination
          currentPage={data?.meta.current_page ?? 1}
          lastPage={data?.meta.last_page ?? 1}
          total={data?.meta.total ?? 0}
          onPage={setPage}
        />
      </div>

      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nueva empresa' : 'Editar empresa'}>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg whitespace-pre-line">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre comercial *" error={errors.nombre?.message} {...register('nombre')} />
            <Input label="Razón social" {...register('nombre_legal')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="RTN" {...register('rtn')} />
            <Input label="Correo" type="email" error={errors.correo?.message} {...register('correo')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Teléfono" {...register('telefono')} />
            <Input label="Dirección" {...register('direccion')} />
          </div>
          <Controller
            name="rubro"
            control={control}
            render={({ field }) => (
              <ComboBox
                label="Rubro"
                placeholder="— Sin especificar —"
                value={field.value ?? ''}
                onChange={v => field.onChange(v)}
                options={RUBROS}
              />
            )}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
