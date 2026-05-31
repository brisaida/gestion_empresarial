import { useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saRolesApi } from '@/api/superAdmin'
import { Table, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { getAxiosError } from '@/lib/utils'
import { MODULOS } from '@/lib/modulos'
import type { RolAdmin } from '@/types'

interface FormState {
  nombre: string
  descripcion: string
  modulos: string[] | null  // null = sin restricciones (admin total)
}

const EMPTY_FORM: FormState = { nombre: '', descripcion: '', modulos: null }

function ModulosSelector({ value, onChange }: {
  value: string[] | null
  onChange: (v: string[] | null) => void
}) {
  const sinRestricciones = value === null

  const toggle = (key: string) => {
    const current = value ?? []
    onChange(current.includes(key) ? current.filter(k => k !== key) : [...current, key])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Módulos permitidos</p>
        <button type="button"
          onClick={() => onChange(sinRestricciones ? [] : null)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
            sinRestricciones
              ? 'bg-[#0E78D8]/10 text-[#0E78D8]'
              : 'bg-gray-100 text-[#5F6B7A] hover:bg-gray-200'
          }`}>
          {sinRestricciones ? '✓ Acceso total' : 'Acceso total'}
        </button>
      </div>

      {sinRestricciones ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0E78D8]/5 border border-[#0E78D8]/20 rounded-lg text-sm text-[#0E78D8]">
          <ShieldCheck size={15} className="shrink-0" />
          Este rol tiene acceso a todos los módulos sin restricciones.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {MODULOS.map(m => {
            const checked = (value ?? []).includes(m.key)
            return (
              <label key={m.key}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-[#0E78D8]/5' : 'hover:bg-gray-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(m.key)}
                  className="rounded accent-[#0E78D8] shrink-0" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${checked ? 'text-[#072B5A]' : 'text-[#5F6B7A]'}`}>{m.label}</p>
                  <p className="text-xs text-gray-400 truncate">{m.descripcion}</p>
                </div>
              </label>
            )
          })}
          {(value ?? []).length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 text-amber-700 text-xs">
              <ShieldOff size={14} className="shrink-0" />
              Sin módulos seleccionados — este rol no tendrá acceso a nada.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RolesAdminPage() {
  const qc = useQueryClient()
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected]     = useState<RolAdmin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RolAdmin | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [error, setError]           = useState('')

  const { data: roles, isLoading } = useQuery({
    queryKey: ['sa-roles'],
    queryFn:  () => saRolesApi.list().then(r => r.data.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-roles'] })

  const createMut = useMutation({
    mutationFn: () => saRolesApi.create(form),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: () => saRolesApi.update(selected!.id, form),
    onSuccess:  () => { invalidate(); closeModal() },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: saRolesApi.remove,
    onSuccess:  () => { invalidate(); setDeleteTarget(null) },
    onError:    (e) => setError(getAxiosError(e)),
  })

  const openCreate = () => {
    setForm(EMPTY_FORM); setError(''); setModal('create')
  }

  const openEdit = (r: RolAdmin) => {
    setSelected(r)
    setForm({ nombre: r.nombre, descripcion: r.descripcion ?? '', modulos: r.modulos })
    setError(''); setModal('edit')
  }

  const closeModal = () => { setModal(null); setSelected(null); setError('') }

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
      key: 'modulos', header: 'Módulos', width: '180px',
      cell: r => r.modulos === null
        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0E78D8]"><ShieldCheck size={12} />Acceso total</span>
        : <span className="text-xs text-[#5F6B7A]">{r.modulos.length} módulo{r.modulos.length !== 1 ? 's' : ''}</span>,
    },
    {
      key: 'asignaciones', header: 'En uso', align: 'center', width: '80px',
      cell: r => (
        <span className={`text-sm font-medium rounded-full px-2.5 py-0.5 ${r.asignaciones > 0 ? 'text-blue-700 bg-blue-50' : 'text-gray-400 bg-gray-100'}`}>
          {r.asignaciones}
        </span>
      ),
    },
    {
      key: 'acciones', header: '', align: 'right', width: '80px',
      cell: r => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)}
            className="p-1.5 rounded text-gray-400 hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors">
            <Pencil size={15} />
          </button>
          <button
            onClick={() => { setError(''); setDeleteTarget(r) }}
            disabled={r.asignaciones > 0}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
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
          <p className="text-sm text-[#5F6B7A]">Define qué módulos puede acceder cada rol</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo rol</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table columns={columns} data={roles ?? []} loading={isLoading} emptyMessage="No hay roles registrados." />
      </div>

      {/* Modal crear/editar */}
      <Modal open={!!modal} onClose={closeModal} title={modal === 'create' ? 'Nuevo rol' : 'Editar rol'} size="md">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
            </div>
          </div>

          <ModulosSelector
            value={form.modulos}
            onChange={modulos => setForm(f => ({ ...f, modulos }))}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              loading={createMut.isPending || updateMut.isPending}
              disabled={!form.nombre.trim()}
              onClick={() => modal === 'create' ? createMut.mutate() : updateMut.mutate()}
            >
              {modal === 'create' ? 'Crear rol' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmar eliminación */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar rol" size="sm">
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <p className="text-sm text-gray-600 mb-5">
          ¿Eliminar el rol <span className="font-semibold text-[#072B5A]">{deleteTarget?.nombre}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleteMut.isPending}
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
