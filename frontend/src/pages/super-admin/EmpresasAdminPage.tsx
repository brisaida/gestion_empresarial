import { useState } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import ComboBox from '@/components/ui/ComboBox'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saEmpresasApi, saRolesApi } from '@/api/superAdmin'
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
]

const schema = z.object({
  nombre:       z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(255),
  nombre_legal: z.string().max(255).optional().or(z.literal('')),
  rtn:          z.string().max(20, 'El RTN no puede tener más de 20 caracteres').optional().or(z.literal('')),
  correo:       z.string().email('Ingresa un correo electrónico válido').optional().or(z.literal('')),
  telefono:     z.string().max(30, 'El teléfono es demasiado largo').optional().or(z.literal('')),
  direccion:    z.string().max(500).optional().or(z.literal('')),
  rubro:        z.enum(['tienda', 'distribuidora', 'farmacia', 'ferreteria']).or(z.literal('')).optional(),
  // Primer administrador (solo al crear; opcional)
  admin_nombre:   z.string().max(255).optional().or(z.literal('')),
  admin_correo:   z.string().email('Ingresa un correo válido').optional().or(z.literal('')),
  admin_password: z.string().optional().or(z.literal('')),
  admin_rol_id:   z.string().optional(),
}).refine(v => !v.admin_correo || !!v.admin_nombre?.trim(), { path: ['admin_nombre'], message: 'Escribe el nombre del administrador' })
  .refine(v => !v.admin_nombre?.trim() || !!v.admin_correo, { path: ['admin_correo'], message: 'Escribe el correo del administrador' })
  .refine(v => !v.admin_password || v.admin_password.length >= 8, { path: ['admin_password'], message: 'Mínimo 8 caracteres' })
type FormValues = z.infer<typeof schema>

export default function EmpresasAdminPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const { setEmpresa } = useAuth()
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

  const { data: roles } = useQuery({
    queryKey: ['sa-roles'],
    queryFn:  () => saRolesApi.list().then(r => r.data.data),
    enabled:  modal === 'create',
  })

  // Soporte: abrir la empresa como super admin (acceso total)
  const entrar = (e: EmpresaAdmin) => {
    qc.clear()
    setEmpresa({ id: e.id, nombre: e.nombre, rol: 0, logo_url: e.logo_url ?? null, modulos: null, rubro: e.rubro ?? null })
    navigate('/dashboard')
  }

  const createMut = useMutation({
    mutationFn: saEmpresasApi.create,
    onSuccess:  (res) => {
      invalidate(); closeModal()
      const admin = res.data.data.admin
      toast.success(admin
        ? `Empresa creada. ${admin.nombre} (${admin.correo}) ${admin.existente ? 'ya tenía cuenta y ahora tiene acceso' : 'ya puede iniciar sesión'}.`
        : 'Empresa creada. Asígnale usuarios desde Usuarios.')
    },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EmpresaAdmin> }) => saEmpresasApi.update(id, data),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const toggleMut = useMutation({
    mutationFn: saEmpresasApi.toggle,
    onSuccess:  invalidate,
  })

  const openCreate = () => {
    reset({ nombre: '', nombre_legal: '', rtn: '', correo: '', telefono: '', direccion: '', rubro: '', admin_nombre: '', admin_correo: '', admin_password: '', admin_rol_id: '' })
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
    const { admin_nombre, admin_correo, admin_password, admin_rol_id, ...empresa } = values
    const data = { ...empresa, rubro: values.rubro || null }
    if (modal === 'create') {
      await createMut.mutateAsync({
        ...data,
        ...(admin_correo ? {
          admin_nombre: admin_nombre?.trim(), admin_correo,
          admin_password: admin_password || undefined, admin_rol_id: admin_rol_id ? Number(admin_rol_id) : undefined,
        } : {}),
      })
    } else if (selected) await updateMut.mutateAsync({ id: selected.id, data })
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
      key: 'acciones', header: 'Acciones', align: 'right', width: '170px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => entrar(r)} disabled={!r.activo}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title={r.activo ? 'Abrir esta empresa para dar soporte' : 'Empresa desactivada'}>
            <LogIn size={14} /> Entrar
          </button>
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
          {modal === 'create' && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus size={15} className="text-purple-600" />
                <p className="text-sm font-semibold text-[#072B5A]">Primer administrador</p>
                <span className="text-xs text-[#5F6B7A]">— opcional; quien va a manejar esta empresa</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre" error={errors.admin_nombre?.message} {...register('admin_nombre')} />
                <Input label="Correo (usuario)" type="email" error={errors.admin_correo?.message} {...register('admin_correo')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Contraseña" type="password" autoComplete="new-password" error={errors.admin_password?.message}
                  placeholder="Si el correo ya existe, déjala vacía" {...register('admin_password')} />
                <Controller name="admin_rol_id" control={control} render={({ field }) => (
                  <ComboBox label="Rol" placeholder="Acceso total (por defecto)" value={field.value ?? ''} onChange={v => field.onChange(String(v))}
                    options={roles?.map(r => ({ value: r.id, label: r.nombre })) ?? []} />
                )} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
