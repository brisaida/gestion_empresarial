import { useState } from 'react'
import ComboBox from '@/components/ui/ComboBox'
import { Plus, Trash2, ChefHat, Pencil, X, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { recetasApi, productosApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Receta, RecetaIngrediente } from '@/types'

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all'
const labelCls = 'block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1'

// ── Form de ingredientes ──────────────────────────────────────────────────────

interface IngForm { producto_id: string; cantidad: string }
const emptyIng = (): IngForm => ({ producto_id: '', cantidad: '' })

interface RecetaFormProps {
  open: boolean
  onClose: () => void
  empresaId: number
  editando: Receta | null
}

function RecetaFormModal({ open, onClose, empresaId, editando }: RecetaFormProps) {
  const qc = useQueryClient()
  const [nombre,      setNombre]      = useState(editando?.nombre       ?? '')
  const [descripcion, setDescripcion] = useState(editando?.descripcion  ?? '')
  const [precio,      setPrecio]      = useState(String(editando?.precio_venta ?? ''))
  const [ings,        setIngs]        = useState<IngForm[]>(
    editando?.ingredientes.length
      ? editando.ingredientes.map(i => ({ producto_id: String(i.producto_id), cantidad: String(i.cantidad) }))
      : [emptyIng()]
  )
  const [error, setError] = useState('')

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-all', empresaId],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const guardar = useMutation({
    mutationFn: (payload: unknown) => editando
      ? recetasApi.update(editando.id, payload)
      : recetasApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recetas', empresaId] })
      onClose()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  function handleSubmit() {
    setError('')
    if (!nombre.trim()) return setError('El nombre es requerido.')
    if (!precio || Number(precio) <= 0) return setError('El precio de venta es requerido.')
    const ingsValidos = ings.filter(i => i.producto_id && Number(i.cantidad) > 0)
    if (!ingsValidos.length) return setError('Agrega al menos un ingrediente con cantidad.')

    guardar.mutate({
      empresa_id:   empresaId,
      nombre:       nombre.trim(),
      descripcion:  descripcion.trim() || null,
      precio_venta: Number(precio),
      activo:       true,
      ingredientes: ingsValidos.map(i => ({
        producto_id: Number(i.producto_id),
        cantidad:    Number(i.cantidad),
      })),
    })
  }

  const getProd = (id: string) => productos.find(p => String(p.id) === id)

  // Costo calculado en tiempo real
  const costoCalc = ings.reduce((sum, i) => {
    const p = getProd(i.producto_id)
    return sum + (Number(i.cantidad) || 0) * (p ? Number(p.costo) : 0)
  }, 0)

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar receta' : 'Nueva receta'} size="lg">
      <div className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Input label="Nombre del plato / receta *" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pollo asado con arroz" autoFocus />
          </div>
          <div className="sm:col-span-2">
            <Input label="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div>
            <Input label="Precio de venta *" type="number" step="0.01" min="0" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col justify-end pb-0.5">
            <p className={`text-sm font-semibold ${Number(precio) > costoCalc ? 'text-emerald-600' : costoCalc > 0 ? 'text-red-500' : 'text-[#5F6B7A]'}`}>
              Costo estimado: {formatCurrency(costoCalc)}
            </p>
            {costoCalc > 0 && Number(precio) > 0 && (
              <p className="text-xs text-[#5F6B7A]">
                Margen: {(((Number(precio) - costoCalc) / Number(precio)) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Ingredientes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={labelCls}>Ingredientes *</p>
            <button type="button" onClick={() => setIngs(p => [...p, emptyIng()])}
              className="flex items-center gap-1 text-xs font-semibold text-[#0E78D8] hover:text-[#072B5A]">
              <Plus size={13} /> Agregar
            </button>
          </div>

          <div className="space-y-2">
            {ings.map((ing, i) => {
              const prod = getProd(ing.producto_id)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[#F4F7FA] rounded-lg px-3 py-2">
                  <div className="col-span-6">
                    <ComboBox
                      value={ing.producto_id}
                      onChange={v => setIngs(p => p.map((x, idx) => idx === i ? { ...x, producto_id: v } : x))}
                      placeholder="Seleccionar ingrediente…"
                      options={productos.map(p => ({
                        value: p.id,
                        label: `${p.codigo ? `[${p.codigo}] ` : ''}${p.nombre}${p.unidad_medida ? ` (${p.unidad_medida.abreviatura})` : ''}`,
                      }))}
                    />
                  </div>
                  <div className="col-span-3">
                    <input type="number" step="any" min="0.0001" value={ing.cantidad} placeholder="Cant."
                      onChange={e => setIngs(p => p.map((x, idx) => idx === i ? { ...x, cantidad: e.target.value } : x))}
                      className={inputCls} />
                  </div>
                  <div className="col-span-2 text-xs text-[#5F6B7A] font-medium text-right">
                    {prod && ing.cantidad
                      ? formatCurrency(Number(ing.cantidad) * Number(prod.costo))
                      : '—'}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button"
                      onClick={() => ings.length > 1 && setIngs(p => p.filter((_, idx) => idx !== i))}
                      disabled={ings.length === 1}
                      className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="button" onClick={handleSubmit} loading={guardar.isPending} className="flex-1">
            {editando ? 'Guardar cambios' : 'Crear receta'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Tarjeta de receta ─────────────────────────────────────────────────────────

function RecetaCard({ receta, onEdit, onDelete }: { receta: Receta; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const margen = receta.precio_venta > 0 && receta.costo_total != null
    ? (((receta.precio_venta - receta.costo_total) / receta.precio_venta) * 100)
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0E78D8]/10 flex items-center justify-center shrink-0 mt-0.5">
              <ChefHat size={16} className="text-[#0E78D8]" />
            </div>
            <div>
              <h3 className="font-bold text-[#072B5A] text-sm leading-tight">{receta.nombre}</h3>
              {receta.descripcion && (
                <p className="text-xs text-[#5F6B7A] mt-0.5 line-clamp-1">{receta.descripcion}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-[#5F6B7A] hover:text-[#0E78D8] hover:bg-[#0E78D8]/8 transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-[#5F6B7A] hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1">
            <p className="text-[10px] text-[#5F6B7A] font-semibold uppercase">Precio venta</p>
            <p className="text-base font-bold text-[#072B5A]">{formatCurrency(receta.precio_venta)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[#5F6B7A] font-semibold uppercase">Costo</p>
            <p className="text-sm font-semibold text-[#072B5A]">{formatCurrency(receta.costo_total ?? 0)}</p>
          </div>
          {margen !== null && (
            <div className="flex-1">
              <p className="text-[10px] text-[#5F6B7A] font-semibold uppercase">Margen</p>
              <p className={`text-sm font-bold ${margen >= 30 ? 'text-emerald-600' : margen >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                {margen.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setExpanded(e => !e)}
          className="mt-3 text-xs text-[#0E78D8] font-semibold flex items-center gap-1 hover:underline">
          <Package size={11} />
          {receta.ingredientes.length} ingrediente{receta.ingredientes.length !== 1 ? 's' : ''}
          {expanded ? ' (ocultar)' : ' (ver)'}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1">
            {receta.ingredientes.map((ing: RecetaIngrediente) => (
              <div key={ing.id} className="flex items-center justify-between text-xs bg-[#F4F7FA] rounded px-2.5 py-1.5">
                <span className="text-[#072B5A] font-medium">{ing.producto}</span>
                <span className="text-[#5F6B7A]">{ing.cantidad} {ing.unidad ?? ''}</span>
                <span className="text-[#5F6B7A] font-semibold">{formatCurrency(ing.cantidad * ing.costo_unit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function RecetasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [modalOpen, setModalOpen]   = useState(false)
  const [editando,  setEditando]    = useState<Receta | null>(null)
  const [search,    setSearch]      = useState('')
  const [deleteMsg, setDeleteMsg]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['recetas', empresaId],
    queryFn:  () => recetasApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data),
    enabled:  empresaId > 0,
  })

  const recetas: Receta[] = (data as { data?: Receta[] })?.data ?? []

  const eliminar = useMutation({
    mutationFn: (id: number) => recetasApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recetas', empresaId] }),
    onError:   (err) => setDeleteMsg(getAxiosError(err)),
  })

  function abrirNueva() { setEditando(null); setModalOpen(true) }
  function abrirEditar(r: Receta) { setEditando(r); setModalOpen(true) }

  const filtradas = recetas.filter(r =>
    !search || r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A] flex items-center gap-2">
            <ChefHat size={20} className="text-[#0E78D8]" /> Recetas / Platos
          </h1>
          <p className="text-sm text-[#5F6B7A]">Define los platos del menú con sus ingredientes y costos</p>
        </div>
        <Button icon={<Plus size={15} />} onClick={abrirNueva}>Nueva receta</Button>
      </div>

      {/* Buscador */}
      <div className="max-w-sm">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar receta…"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]" />
      </div>

      {deleteMsg && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} />{deleteMsg}
          <button onClick={() => setDeleteMsg('')}><X size={14} /></button>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16 text-[#5F6B7A] text-sm">Cargando recetas…</div>
      )}

      {!isLoading && filtradas.length === 0 && (
        <div className="text-center py-16">
          <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[#5F6B7A] font-medium">
            {search ? 'No hay recetas que coincidan con la búsqueda.' : 'Aún no has creado ninguna receta.'}
          </p>
          {!search && (
            <button onClick={abrirNueva} className="mt-3 text-sm text-[#0E78D8] font-semibold hover:underline">
              Crear primera receta
            </button>
          )}
        </div>
      )}

      {filtradas.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs text-[#5F6B7A]">
            <CheckCircle2 size={13} className="text-emerald-500" />
            {filtradas.length} receta{filtradas.length !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map(r => (
              <RecetaCard
                key={r.id}
                receta={r}
                onEdit={() => abrirEditar(r)}
                onDelete={() => { if (confirm(`¿Eliminar receta "${r.nombre}"?`)) eliminar.mutate(r.id) }}
              />
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <RecetaFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          empresaId={empresaId}
          editando={editando}
        />
      )}
    </div>
  )
}
