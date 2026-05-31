import { useState } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, KeyRound, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saUsuariosApi, saEmpresasApi, saRolesApi } from '@/api/superAdmin'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import SearchBar from '@/components/ui/SearchBar'
import { getAxiosError } from '@/lib/utils'
import type { UsuarioAdmin, UsuarioEmpresaItem } from '@/types'

const userSchema = z.object({
  nombre:         z.string().min(1, 'Requerido'),
  correo:         z.string().email('Correo inválido'),
  password:       z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  es_super_admin: z.boolean().optional(),
  empresa_id:     z.coerce.number().optional(),
  rol_id:         z.coerce.number().optional(),
})
type UserForm = z.infer<typeof userSchema>

const accesoSchema = z.object({
  empresa_id: z.coerce.number().min(1, 'Selecciona una empresa'),
  rol_id:     z.coerce.number().min(1, 'Selecciona un rol'),
})
type AccesoForm = z.infer<typeof accesoSchema>

export default function UsuariosAdminPage() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected]     = useState<UsuarioAdmin | null>(null)
  const [accesoUser, setAccesoUser] = useState<UsuarioAdmin | null>(null)
  const [error, setError]       = useState('')
  const [accesoError, setAccesoError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sa-usuarios', page, search],
    queryFn:  () => saUsuariosApi.list({ page, search: search || undefined, per_page: 15 }).then(r => r.data),
  })

  const { data: accesoData, isLoading: loadingAccesos } = useQuery({
    queryKey: ['sa-usuario-empresas', accesoUser?.id],
    queryFn:  () => saUsuariosApi.empresas(accesoUser!.id).then(r => r.data.data),
    enabled:  !!accesoUser,
  })

  const { data: empresasData } = useQuery({
    queryKey: ['sa-empresas-lista'],
    queryFn:  () => saEmpresasApi.list({ per_page: 100 }).then(r => r.data),
    enabled:  !!accesoUser || modal === 'create',
  })

  const { data: rolesData } = useQuery({
    queryKey: ['sa-roles'],
    queryFn:  () => saRolesApi.list().then(r => r.data.data),
    enabled:  !!accesoUser || modal === 'create',
  })

  const userForm = useForm<UserForm>({ resolver: zodResolver(userSchema) })
  const accesoForm = useForm<AccesoForm>({ resolver: zodResolver(accesoSchema) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-usuarios'] })

  const createMut = useMutation({
    mutationFn: (data: UserForm) => saUsuariosApi.create({ nombre: data.nombre, correo: data.correo, password: data.password!, es_super_admin: data.es_super_admin }),
    onError: (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserForm }) =>
      saUsuariosApi.update(id, { nombre: data.nombre, correo: data.correo, es_super_admin: data.es_super_admin, password: data.password || undefined }),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const toggleMut = useMutation({
    mutationFn: saUsuariosApi.toggle,
    onSuccess:  invalidate,
  })

  const asignarMut = useMutation({
    mutationFn: (data: AccesoForm) => saUsuariosApi.asignarEmpresa(accesoUser!.id, { empresa_id: data.empresa_id, rol_id: data.rol_id }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['sa-usuario-empresas', accesoUser?.id] })
      invalidate()
      accesoForm.reset()
      setAccesoError('')
    },
    onError: (e) => setAccesoError(getAxiosError(e)),
  })

  const quitarMut = useMutation({
    mutationFn: (empresaId: number) => saUsuariosApi.quitarEmpresa(accesoUser!.id, empresaId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['sa-usuario-empresas', accesoUser?.id] })
      invalidate()
    },
  })

  const openCreate = () => {
    userForm.reset({ nombre: '', correo: '', password: '', es_super_admin: false })
    setError('')
    setModal('create')
  }

  const openEdit = (u: UsuarioAdmin) => {
    setSelected(u)
    userForm.reset({ nombre: u.nombre, correo: u.correo, password: '', es_super_admin: u.es_super_admin })
    setError('')
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setSelected(null); setError('') }

  const onSubmitUser = async (values: UserForm) => {
    if (modal === 'create') {
      const newUser = await createMut.mutateAsync(values)
      if (values.empresa_id && values.rol_id) {
        const userId = (newUser.data as { data: { id: number } }).data.id
        await saUsuariosApi.asignarEmpresa(userId, { empresa_id: values.empresa_id, rol_id: values.rol_id })
      }
      invalidate()
      closeModal()
    } else if (selected) {
      await updateMut.mutateAsync({ id: selected.id, data: values })
    }
  }

  const empresasOptions = (empresasData?.data ?? []).map(e => ({ value: e.id, label: e.nombre }))
  const rolesOptions    = (rolesData ?? []).map(r => ({ value: r.id, label: r.nombre }))

  const columns: Column<UsuarioAdmin>[] = [
    {
      key: 'nombre', header: 'Usuario',
      cell: r => (
        <div>
          <p className="font-semibold text-[#072B5A]">{r.nombre}</p>
          <p className="text-xs text-gray-400">{r.correo}</p>
        </div>
      ),
    },
    {
      key: 'es_super_admin', header: 'Rol global', align: 'center', width: '120px',
      cell: r => r.es_super_admin
        ? <span className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-full px-2.5 py-0.5">Super Admin</span>
        : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'empresas_count', header: 'Empresas', align: 'center', width: '90px',
      cell: r => <span className="text-sm font-medium text-blue-700 bg-blue-50 rounded-full px-2.5 py-0.5">{r.empresas_count}</span>,
    },
    { key: 'activo', header: 'Estado', align: 'center', width: '90px', cell: r => <StatusBadge activo={r.activo} /> },
    {
      key: 'acciones', header: 'Acciones', align: 'right', width: '130px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Editar">
            <Pencil size={15} />
          </button>
          <button onClick={() => { setAccesoUser(r); accesoForm.reset(); setAccesoError('') }} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Gestionar accesos">
            <KeyRound size={15} />
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
          <h1 className="text-xl font-bold text-[#072B5A]">Usuarios</h1>
          <p className="text-sm text-[#5F6B7A]">Gestión de usuarios y sus accesos a empresas</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo usuario</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Buscar usuarios..." className="max-w-xs" />
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay usuarios registrados." />
        <Pagination
          currentPage={data?.meta.current_page ?? 1}
          lastPage={data?.meta.last_page ?? 1}
          total={data?.meta.total ?? 0}
          onPage={setPage}
        />
      </div>

      {/* Modal crear/editar usuario */}
      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" error={userForm.formState.errors.nombre?.message} {...userForm.register('nombre')} />
            <Input label="Correo *" type="email" error={userForm.formState.errors.correo?.message} {...userForm.register('correo')} />
          </div>
          <Input
            label={modal === 'create' ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}
            type="password"
            error={userForm.formState.errors.password?.message}
            {...userForm.register('password')}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...userForm.register('es_super_admin')} className="rounded" />
            Es super administrador
          </label>

          {modal === 'create' && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignar a empresa (opcional)</p>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Empresa"
                  placeholder="Sin asignar"
                  options={empresasOptions}
                  {...userForm.register('empresa_id')}
                />
                <Select
                  label="Rol"
                  placeholder="Seleccionar..."
                  options={rolesOptions}
                  {...userForm.register('rol_id')}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={userForm.formState.isSubmitting}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal gestionar accesos */}
      <Modal open={!!accesoUser} onClose={() => setAccesoUser(null)} title={`Accesos — ${accesoUser?.nombre}`} size="lg">
        <div className="space-y-5">
          {/* Lista de accesos actuales */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Empresas asignadas</p>
            {loadingAccesos ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : (accesoData ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin empresas asignadas.</p>
            ) : (
              <div className="space-y-2">
                {(accesoData as UsuarioEmpresaItem[]).map(item => (
                  <div key={item.empresa_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-[#072B5A]">{item.empresa_nombre}</p>
                      <p className="text-xs text-gray-400">{item.rol_nombre}</p>
                    </div>
                    <button
                      onClick={() => quitarMut.mutate(item.empresa_id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Quitar acceso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asignar nueva empresa */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Asignar a empresa</p>
            {accesoError && <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{accesoError}</p>}
            <form onSubmit={accesoForm.handleSubmit(data => asignarMut.mutate(data))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Empresa *"
                  placeholder="Seleccionar..."
                  options={empresasOptions}
                  error={accesoForm.formState.errors.empresa_id?.message}
                  {...accesoForm.register('empresa_id')}
                />
                <Select
                  label="Rol *"
                  placeholder="Seleccionar..."
                  options={rolesOptions}
                  error={accesoForm.formState.errors.rol_id?.message}
                  {...accesoForm.register('rol_id')}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={asignarMut.isPending} size="sm">Asignar</Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  )
}
