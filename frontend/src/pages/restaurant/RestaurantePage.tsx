import { useState, useCallback, useEffect } from 'react'
import {
  UtensilsCrossed, Plus, Users, RefreshCw, X, ChefHat,
  CreditCard, Banknote, ArrowLeftRight, Layers, CheckCircle2,
  Pencil, Trash2, Search,
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { mesasApi, bodegasApi, productosApi, recetasApi, comandasApi } from '@/api/recursos'
import { getAxiosError, formatCurrency } from '@/lib/utils'
import type { Mesa, Comanda, Producto, Receta, Bodega, DetalleComanda } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

// ── Helpers ────────────────────────────────────────────────────────────────

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'

type EstadoColor = { bg: string; border: string; text: string; dot: string }
const estadoStyle: Record<Mesa['estado'], EstadoColor> = {
  libre:   { bg: 'bg-white',      border: 'border-gray-200',   text: 'text-gray-500',    dot: 'bg-gray-300' },
  ocupada: { bg: 'bg-amber-50',   border: 'border-amber-300',  text: 'text-amber-700',   dot: 'bg-amber-400' },
  lista:   { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}
const estadoLabel: Record<Mesa['estado'], string> = {
  libre: 'Libre', ocupada: 'Ocupada', lista: 'Lista para cobrar',
}

const estadoComandaBadge = (estado: Comanda['estado']) => {
  const map = {
    pendiente:      'bg-gray-100 text-gray-600',
    en_preparacion: 'bg-amber-100 text-amber-700',
    listo:          'bg-emerald-100 text-emerald-700',
    cancelado:      'bg-red-100 text-red-600',
  }
  const labels = { pendiente: 'Pendiente', en_preparacion: 'En preparación', listo: 'Listo', cancelado: 'Cancelado' }
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[estado]}`}>{labels[estado]}</span>
}

// ── MesaCard ───────────────────────────────────────────────────────────────

function MesaCard({
  mesa, selected, onClick, onEdit, onDelete,
}: {
  mesa: Mesa; selected: boolean; onClick: () => void
  onEdit: () => void; onDelete: () => void
}) {
  const s = estadoStyle[mesa.estado]
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all select-none ${s.bg} ${
        selected ? 'border-[#0E78D8] ring-2 ring-[#0E78D8]/20' : s.border
      } hover:shadow-md`}
    >
      {/* Actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}>
        <button onClick={onEdit}
          className="p-1 rounded text-[#5F6B7A] hover:text-[#0E78D8] hover:bg-[#0E78D8]/10 transition-all">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete}
          className="p-1 rounded text-[#5F6B7A] hover:text-red-500 hover:bg-red-50 transition-all">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Dot status */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-bold text-[#072B5A] text-base leading-tight">{mesa.nombre}</span>
        <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${s.dot}`} />
      </div>

      {mesa.capacidad && (
        <div className="flex items-center gap-1 text-xs text-[#5F6B7A] mb-2">
          <Users size={11} />
          <span>{mesa.capacidad}</span>
        </div>
      )}

      <div className={`text-xs font-semibold ${s.text}`}>
        {estadoLabel[mesa.estado]}
        {mesa.estado !== 'libre' && (
          <span className="ml-1 text-[#5F6B7A] font-normal">
            ({mesa.comandas_activas + mesa.comandas_listas} ronda{mesa.comandas_activas + mesa.comandas_listas !== 1 ? 's' : ''})
          </span>
        )}
      </div>
    </div>
  )
}

// ── MesaFormModal ──────────────────────────────────────────────────────────

function MesaFormModal({
  open, mesa, empresaId, onClose, onDone,
}: {
  open: boolean; mesa: Mesa | null; empresaId: number
  onClose: () => void; onDone: () => void
}) {
  const [nombre, setNombre]       = useState('')
  const [capacidad, setCapacidad] = useState('')
  const [error, setError]         = useState('')

  useEffect(() => {
    if (open) {
      setNombre(mesa?.nombre ?? '')
      setCapacidad(mesa?.capacidad ? String(mesa.capacidad) : '')
      setError('')
    }
  }, [open, mesa])

  const save = useMutation({
    mutationFn: () =>
      mesa
        ? mesasApi.update(mesa.id, { nombre, capacidad: capacidad ? Number(capacidad) : null })
        : mesasApi.create({ empresa_id: empresaId, nombre, capacidad: capacidad ? Number(capacidad) : null }),
    onSuccess: onDone,
    onError: (e) => setError(getAxiosError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title={mesa ? 'Editar mesa' : 'Nueva mesa'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#072B5A] mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Mesa 1, Barra, Terraza..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#072B5A] mb-1">Capacidad (personas)</label>
          <input
            type="number"
            min={1}
            value={capacidad}
            onChange={e => setCapacidad(e.target.value)}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            loading={save.isPending}
            disabled={!nombre.trim()}
            onClick={() => save.mutate()}
            className="flex-1"
          >
            {mesa ? 'Guardar' : 'Crear mesa'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── NuevaRondaModal ────────────────────────────────────────────────────────

type CartLine = { key: string; nombre: string; precio: number; qty: number; producto_id?: number; receta_id?: number }

function NuevaRondaModal({
  mesa, bodegaId, empresaId, onClose, onDone,
}: {
  mesa: Mesa; bodegaId: number; empresaId: number
  onClose: () => void; onDone: () => void
}) {
  const [cart, setCart]     = useState<Map<string, CartLine>>(new Map())
  const [search, setSearch] = useState('')
  const [obs, setObs]       = useState('')
  const [error, setError]   = useState('')

  const { data: prods }   = useQuery({
    queryKey: ['productos', empresaId, 'venta'],
    queryFn:  () => productosApi.list({ empresa_id: empresaId, tipo: 'venta', per_page: 200, activo: 1 })
      .then(r => r.data.data),
  })

  const { data: recetas } = useQuery({
    queryKey: ['recetas', empresaId],
    queryFn:  () => recetasApi.list({ empresa_id: empresaId, per_page: 200 }).then(r => r.data.data),
  })

  const addItem = (key: string, nombre: string, precio: number, producto_id?: number, receta_id?: number) => {
    setCart(prev => {
      const next = new Map(prev)
      const existing = next.get(key)
      next.set(key, { key, nombre, precio, qty: (existing?.qty ?? 0) + 1, producto_id, receta_id })
      return next
    })
  }

  const changeQty = (key: string, delta: number) => {
    setCart(prev => {
      const next = new Map(prev)
      const item = next.get(key)
      if (!item) return prev
      if (item.qty + delta <= 0) { next.delete(key); return next }
      next.set(key, { ...item, qty: item.qty + delta })
      return next
    })
  }

  const items   = [...cart.values()]
  const total   = items.reduce((s, l) => s + l.precio * l.qty, 0)
  const isEmpty = items.length === 0

  const filtered = [
    ...((recetas ?? []).map(r => ({ key: `r-${r.id}`, nombre: r.nombre, precio: r.precio_venta, receta_id: r.id as number | undefined, producto_id: undefined as number | undefined }))),
    ...((prods   ?? []).map(p => ({ key: `p-${p.id}`, nombre: p.nombre, precio: p.precio_venta, producto_id: p.id as number | undefined, receta_id: undefined as number | undefined }))),
  ].filter(i => !search || i.nombre.toLowerCase().includes(search.toLowerCase()))

  const enviar = useMutation({
    mutationFn: () => {
      const detalles = items.map(l => ({
        producto_id:     l.producto_id ?? null,
        receta_id:       l.receta_id   ?? null,
        nombre_item:     l.nombre,
        cantidad:        l.qty,
        precio_unitario: l.precio,
      }))
      return comandasApi.create({
        empresa_id:   empresaId,
        bodega_id:    bodegaId,
        mesa_id:      mesa.id,
        mesa:         mesa.nombre,
        observaciones: obs || null,
        detalles,
      })
    },
    onSuccess: onDone,
    onError:   (e) => setError(getAxiosError(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Nueva ronda — ${mesa.nombre}`} size="lg">
      <div className="flex gap-4 h-[70vh] min-h-0">
        {/* Productos / Recetas */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar platillo o producto..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8]"
            />
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            {filtered.map(item => {
              const inCart = cart.get(item.key)
              return (
                <button
                  key={item.key}
                  onClick={() => addItem(item.key, item.nombre, item.precio, item.producto_id, item.receta_id)}
                  className={`text-left p-3 rounded-xl border-2 transition-all hover:shadow-sm active:scale-[0.97] ${
                    inCart ? 'border-[#0E78D8] bg-[#0E78D8]/5' : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-[#072B5A] leading-tight line-clamp-2">{item.nombre}</p>
                  <p className="text-xs text-[#0E78D8] font-bold mt-1">{formatCurrency(item.precio)}</p>
                  {inCart && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-white bg-[#0E78D8] px-1.5 py-0.5 rounded-full">
                      ×{inCart.qty} en carrito
                    </span>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-10 text-[#5F6B7A] text-sm">
                No se encontraron resultados
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="w-56 shrink-0 flex flex-col border-l border-gray-100 pl-4">
          <p className="text-xs font-bold text-[#5F6B7A] uppercase tracking-widest mb-3">Pedido</p>
          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400 text-center">Toca un ítem para agregar</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {items.map(line => (
                <div key={line.key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#072B5A] leading-tight truncate">{line.nombre}</p>
                    <p className="text-xs text-[#5F6B7A]">{formatCurrency(line.precio)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(line.key, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#072B5A] font-bold text-sm flex items-center justify-center">
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-[#072B5A]">{line.qty}</span>
                    <button onClick={() => changeQty(line.key, +1)}
                      className="w-6 h-6 rounded-full bg-[#0E78D8]/10 hover:bg-[#0E78D8]/20 text-[#0E78D8] font-bold text-sm flex items-center justify-center">
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isEmpty && (
            <>
              <div className="border-t border-gray-100 pt-2 mb-2">
                <div className="flex justify-between text-sm font-bold text-[#072B5A]">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
              <input
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Observaciones..."
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30"
              />
            </>
          )}

          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

          <div className="space-y-2">
            <Button variant="secondary" onClick={onClose} className="w-full justify-center">Cancelar</Button>
            <Button
              icon={<ChefHat size={14} />}
              loading={enviar.isPending}
              disabled={isEmpty}
              onClick={() => enviar.mutate()}
              className="w-full justify-center"
            >
              Enviar a cocina
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── CobrarModal ────────────────────────────────────────────────────────────

const metodoPagoOpts: { key: MetodoPago; label: string; icon: typeof Banknote }[] = [
  { key: 'efectivo',     label: 'Efectivo',      icon: Banknote         },
  { key: 'tarjeta',      label: 'Tarjeta',       icon: CreditCard       },
  { key: 'transferencia',label: 'Transferencia', icon: ArrowLeftRight   },
  { key: 'mixto',        label: 'Mixto',         icon: Layers           },
]

function CobrarModal({
  mesa, comandas, bodegaId, onClose, onDone,
}: {
  mesa: Mesa; comandas: Comanda[]; bodegaId: number
  onClose: () => void; onDone: () => void
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [error, setError]   = useState('')

  const todasListas   = comandas.filter(c => c.estado === 'listo')
  const tieneActivas  = comandas.some(c => c.estado !== 'listo')
  const allDetalles   = todasListas.flatMap(c => c.detalles)
  const total         = allDetalles.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0)

  const cobrar = useMutation({
    mutationFn: () => mesasApi.facturar(mesa.id, { bodega_id: bodegaId, metodo_pago: metodo }),
    onSuccess:  onDone,
    onError:    (e) => setError(getAxiosError(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Cobrar ${mesa.nombre}`} size="sm">
      <div className="space-y-4">
        {tieneActivas && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
            Hay rondas aún en cocina. Solo se cobrarán las rondas <strong>listas</strong>.
          </div>
        )}

        {/* Resumen de ítems */}
        <div className="bg-[#F4F7FA] rounded-lg p-3 space-y-1.5 max-h-52 overflow-y-auto">
          {todasListas.map(c => (
            <div key={c.id}>
              <p className="text-[10px] font-bold text-[#5F6B7A] uppercase tracking-widest mb-1">{c.numero_comanda}</p>
              {c.detalles.map(d => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span className="text-[#5F6B7A]">{d.nombre_item} ×{d.cantidad}</span>
                  <span className="font-medium text-[#072B5A]">{formatCurrency(d.cantidad * d.precio_unitario)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-[#072B5A]">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <p className="text-sm font-semibold text-[#072B5A] mb-2">Método de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {metodoPagoOpts.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMetodo(key)}
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                  metodo === key
                    ? 'border-[#0E78D8] bg-[#0E78D8]/5 text-[#0E78D8]'
                    : 'border-gray-200 text-[#5F6B7A] hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            icon={<CheckCircle2 size={15} />}
            loading={cobrar.isPending}
            disabled={todasListas.length === 0}
            onClick={() => cobrar.mutate()}
            className="flex-1"
          >
            Cobrar {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── MesaPanel ──────────────────────────────────────────────────────────────

function MesaPanel({
  mesa, comandas, loading, bodegaId, empresaId,
  onClose, onNuevaRonda, onCobrar,
}: {
  mesa: Mesa; comandas: Comanda[]; loading: boolean
  bodegaId: number; empresaId: number
  onClose: () => void; onNuevaRonda: () => void; onCobrar: () => void
}) {
  const activas    = comandas.filter(c => c.estado !== 'cancelado')
  const totalMesa  = activas.flatMap(c => c.detalles)
    .reduce((s, d: DetalleComanda) => s + d.cantidad * d.precio_unitario, 0)
  const hayListas  = activas.some(c => c.estado === 'listo')

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
        <div>
          <h2 className="font-bold text-[#072B5A] text-lg">{mesa.nombre}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${estadoStyle[mesa.estado].dot}`} />
            <span className={`text-sm font-medium ${estadoStyle[mesa.estado].text}`}>
              {estadoLabel[mesa.estado]}
            </span>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg text-[#5F6B7A] hover:bg-gray-100 transition-all">
          <X size={16} />
        </button>
      </div>

      {/* Comandas list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : activas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UtensilsCrossed size={32} className="text-gray-200 mb-3" />
            <p className="text-sm text-[#5F6B7A]">Sin pedidos activos</p>
            <p className="text-xs text-gray-400 mt-1">Agrega una ronda para comenzar</p>
          </div>
        ) : (
          activas.map(comanda => (
            <div key={comanda.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#F4F7FA]">
                <span className="text-xs font-bold text-[#072B5A]">{comanda.numero_comanda}</span>
                {estadoComandaBadge(comanda.estado)}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {comanda.detalles.map(d => (
                  <div key={d.id} className="flex justify-between text-sm">
                    <span className={`${d.listo ? 'line-through text-gray-400' : 'text-[#5F6B7A]'}`}>
                      {d.nombre_item}
                      {d.cantidad !== 1 && <span className="text-[#0E78D8] ml-1">×{d.cantidad}</span>}
                    </span>
                    <span className="font-medium text-[#072B5A] shrink-0 ml-2">
                      {formatCurrency(d.cantidad * d.precio_unitario)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-3 shrink-0">
        {activas.length > 0 && (
          <div className="flex justify-between text-sm font-bold text-[#072B5A]">
            <span>Total mesa</span>
            <span>{formatCurrency(totalMesa)}</span>
          </div>
        )}
        <Button
          icon={<Plus size={15} />}
          variant="secondary"
          onClick={onNuevaRonda}
          className="w-full justify-center"
        >
          Nueva ronda
        </Button>
        <Button
          icon={<CheckCircle2 size={15} />}
          disabled={!hayListas}
          onClick={onCobrar}
          className="w-full justify-center"
        >
          {hayListas ? 'Cobrar mesa' : 'Sin rondas listas'}
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RestaurantePage() {
  const { state }    = useAuth()
  const empresaId    = state.empresaActiva?.id ?? 0

  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null)
  const [comandas,     setComandas]     = useState<Comanda[]>([])
  const [loadingCom,   setLoadingCom]   = useState(false)
  const [showRonda,    setShowRonda]    = useState(false)
  const [showCobrar,   setShowCobrar]   = useState(false)
  const [mesaForm,     setMesaForm]     = useState<{ open: boolean; editando: Mesa | null }>({ open: false, editando: null })
  const [deleteTarget, setDeleteTarget] = useState<Mesa | null>(null)
  const [deleteError,  setDeleteError]  = useState('')

  // Bodega selection
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 50 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })
  const [bodegaId, setBodegaId] = useState<number>(0)
  useEffect(() => {
    if (!bodegaId && bodegas?.length) setBodegaId(bodegas[0].id)
  }, [bodegas, bodegaId])

  // Mesas polling every 30s
  const { data: mesas, refetch: refetchMesas, isFetching } = useQuery({
    queryKey: ['mesas', empresaId],
    queryFn:  () => mesasApi.list({ empresa_id: empresaId }).then(r => r.data.data as Mesa[]),
    enabled:  empresaId > 0,
    refetchInterval: 30_000,
  })

  // Fetch comandas for selected mesa
  const fetchComandas = useCallback(async (mesaId: number) => {
    setLoadingCom(true)
    try {
      const res = await mesasApi.comandas(mesaId)
      setComandas((res.data as { data: Comanda[] }).data)
    } finally {
      setLoadingCom(false)
    }
  }, [])

  const handleSelectMesa = (mesa: Mesa) => {
    setSelectedMesa(mesa)
    fetchComandas(mesa.id)
  }

  const handleClose = () => { setSelectedMesa(null); setComandas([]) }

  // Delete mesa mutation
  const deleteMesa = useMutation({
    mutationFn: (id: number) => mesasApi.delete(id),
    onSuccess:  () => { setDeleteTarget(null); refetchMesas() },
    onError:    (e) => setDeleteError(getAxiosError(e)),
  })

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 sm:-m-6 overflow-hidden">

      {/* Left: Mesa grid */}
      <div className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-300 ${
        selectedMesa ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full'
      }`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 100%)' }}>
                <UtensilsCrossed size={16} className="text-white" />
              </div>
              <h1 className="font-bold text-[#072B5A] text-base">Salón</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refetchMesas()}
                className="p-1.5 rounded-lg border border-gray-200 text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] transition-all">
                <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              </button>
              <Button
                icon={<Plus size={14} />}
                onClick={() => setMesaForm({ open: true, editando: null })}
                className="text-xs px-2.5 py-1.5"
              >
                Mesa
              </Button>
            </div>
          </div>

          {/* Bodega selector */}
          {bodegas && bodegas.length > 1 && (
            <select
              value={bodegaId}
              onChange={e => setBodegaId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#072B5A] focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30"
            >
              {bodegas.map((b: Bodega) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          )}
        </div>

        {/* Legend */}
        <div className="px-4 py-2 flex items-center gap-4 border-b border-gray-50 shrink-0">
          {(['libre', 'ocupada', 'lista'] as Mesa['estado'][]).map(e => (
            <span key={e} className="flex items-center gap-1 text-[10px] text-[#5F6B7A]">
              <span className={`w-2 h-2 rounded-full ${estadoStyle[e].dot}`} />
              {estadoLabel[e]}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!mesas || mesas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <UtensilsCrossed size={36} className="text-gray-200 mb-3" />
              <p className="text-sm text-[#5F6B7A] font-medium">Sin mesas configuradas</p>
              <p className="text-xs text-gray-400 mt-1">Agrega mesas para comenzar</p>
              <Button
                icon={<Plus size={14} />}
                onClick={() => setMesaForm({ open: true, editando: null })}
                className="mt-4 text-sm"
              >
                Nueva mesa
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 group">
              {mesas.map((mesa: Mesa) => (
                <MesaCard
                  key={mesa.id}
                  mesa={mesa}
                  selected={selectedMesa?.id === mesa.id}
                  onClick={() => handleSelectMesa(mesa)}
                  onEdit={() => setMesaForm({ open: true, editando: mesa })}
                  onDelete={() => { setDeleteTarget(mesa); setDeleteError('') }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Mesa detail panel */}
      {selectedMesa ? (
        <div className="flex-1 flex flex-col bg-[#F4F7FA] min-w-0">
          <MesaPanel
            mesa={selectedMesa}
            comandas={comandas}
            loading={loadingCom}
            bodegaId={bodegaId}
            empresaId={empresaId}
            onClose={handleClose}
            onNuevaRonda={() => setShowRonda(true)}
            onCobrar={() => setShowCobrar(true)}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#F4F7FA]">
          <div className="text-center">
            <UtensilsCrossed size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#5F6B7A] font-medium">Selecciona una mesa</p>
            <p className="text-xs text-gray-400 mt-1">para ver sus pedidos o agregar una nueva ronda</p>
          </div>
        </div>
      )}

      {/* Modales */}
      <MesaFormModal
        open={mesaForm.open}
        mesa={mesaForm.editando}
        empresaId={empresaId}
        onClose={() => setMesaForm({ open: false, editando: null })}
        onDone={() => { setMesaForm({ open: false, editando: null }); refetchMesas() }}
      />

      {showRonda && selectedMesa && (
        <NuevaRondaModal
          mesa={selectedMesa}
          bodegaId={bodegaId}
          empresaId={empresaId}
          onClose={() => setShowRonda(false)}
          onDone={() => {
            setShowRonda(false)
            fetchComandas(selectedMesa.id)
            refetchMesas()
          }}
        />
      )}

      {showCobrar && selectedMesa && (
        <CobrarModal
          mesa={selectedMesa}
          comandas={comandas}
          bodegaId={bodegaId}
          onClose={() => setShowCobrar(false)}
          onDone={() => {
            setShowCobrar(false)
            setSelectedMesa(null)
            setComandas([])
            refetchMesas()
          }}
        />
      )}

      {/* Confirm delete mesa */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar mesa"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#5F6B7A]">
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Esta acción es permanente.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button
              variant="danger"
              loading={deleteMesa.isPending}
              onClick={() => deleteTarget && deleteMesa.mutate(deleteTarget.id)}
              className="flex-1"
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
