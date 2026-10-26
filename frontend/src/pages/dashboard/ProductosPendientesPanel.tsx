import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Check, Loader2, Merge, Pencil, PowerOff } from 'lucide-react'
import { dashboardApi, productosApi, categoriasApi } from '@/api/recursos'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate, getAxiosError } from '@/lib/utils'
import type { Categoria, ProductoPendiente } from '@/types'

const inputCls = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]'

/**
 * Productos activos con información pendiente. Cada pendiente se corrige en la
 * misma fila: al guardar se actualiza el producto y la lista se refresca sola.
 */
export default function ProductosPendientesPanel({ empresaId }: { empresaId: number }) {
  const { data: pendientes = [], isLoading } = useQuery({
    queryKey: ['productos-pendientes', empresaId],
    queryFn:  () => dashboardApi.productosPendientes(empresaId).then(r => r.data.data ?? []),
    enabled:  empresaId > 0,
  })

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-activas', empresaId],
    queryFn:  () => categoriasApi.list({ empresa_id: empresaId, per_page: 200, solo_activos: true }).then(r => r.data.data),
    enabled:  empresaId > 0 && pendientes.length > 0,
  })

  if (!isLoading && pendientes.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-[var(--cs)]">Productos pendientes</h2>
          {!isLoading && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">{pendientes.length}</span>
          )}
        </div>
        <p className="text-xs text-[#5F6B7A] hidden sm:block">Completa los datos aquí mismo; cada cambio se guarda al confirmar</p>
      </div>
      <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-3"><div className="h-4 bg-gray-100 rounded-lg w-48 animate-pulse" /></div>
            ))
          : pendientes.map(p => (
              <FilaPendiente key={p.id} producto={p} empresaId={empresaId} categorias={categorias}
                duplicados={p.grupo ? pendientes.filter(o => o.grupo === p.grupo && o.id !== p.id) : []} />
            ))
        }
      </div>
    </div>
  )
}

function BotonOk({ onClick, disabled, cargando }: { onClick: () => void; disabled: boolean; cargando: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title="Guardar"
      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--cp)] text-white disabled:opacity-30 transition-opacity">
      {cargando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
    </button>
  )
}

/** Mismo cálculo que InventarioService::costoUnion en el backend. */
function costoUnion(stockOrigen: number, costoOrigen: number, stockDestino: number, costoDestino: number): number {
  if (costoOrigen <= 0) return costoDestino
  if (costoDestino <= 0) return costoOrigen
  const total = stockOrigen + stockDestino
  if (total <= 0) return costoDestino
  return (stockOrigen * costoOrigen + stockDestino * costoDestino) / total
}

const etiqueta = (p: ProductoPendiente) => p.codigo || 'sin código'

interface FilaProps {
  producto: ProductoPendiente
  empresaId: number
  categorias: Categoria[]
  duplicados: ProductoPendiente[]
}

function FilaPendiente({ producto: p, empresaId, categorias, duplicados }: FilaProps) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [codigo,      setCodigo]      = useState('')
  const [costo,       setCosto]       = useState('')
  const [precio,      setPrecio]      = useState('')
  const [nombre,      setNombre]      = useState(p.nombre)
  const [renombrando, setRenombrando] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [unirCon,     setUnirCon]     = useState<ProductoPendiente | null>(null)
  const [error,       setError]       = useState('')

  const falta = (m: string) => p.pendientes.includes(m)

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['productos-pendientes', empresaId] })
    qc.invalidateQueries({ queryKey: ['productos'] })
    qc.invalidateQueries({ queryKey: ['productos-all', empresaId] })
    qc.invalidateQueries({ queryKey: ['dashboard', empresaId] })
  }

  const guardar = useMutation({
    mutationFn: (data: Record<string, unknown>) => productosApi.update(p.id, data),
    onSuccess:  () => { setError(''); setRenombrando(false); toast.success(`${p.nombre}: actualizado`); refrescar() },
    onError:    (err) => setError(getAxiosError(err)),
  })

  const desactivar = useMutation({
    mutationFn: () => productosApi.eliminar(p.id, false),
    onSuccess:  () => { setConfirmarBaja(false); toast.success(`${p.nombre}: desactivado`); refrescar() },
    onError:    (err) => { setConfirmarBaja(false); setError(getAxiosError(err)) },
  })

  const unir = useMutation({
    mutationFn: (destino: ProductoPendiente) => productosApi.unir(p.id, destino.id),
    onSuccess:  (_, destino) => { setUnirCon(null); toast.success(`${p.nombre} (${etiqueta(p)}) se unió en ${etiqueta(destino)}`); refrescar() },
    onError:    (err) => { setUnirCon(null); setError(getAxiosError(err)) },
  })

  const ocupado = guardar.isPending || desactivar.isPending || unir.isPending

  const enviar = (campo: string, valor: string, convertir: (v: string) => unknown = v => v) => {
    if (!valor.trim() || ocupado) return
    guardar.mutate({ [campo]: convertir(valor.trim()) })
  }

  return (
    <div className="px-6 py-3.5 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
        <div className="min-w-0">
          <Link to={`/productos/${p.id}/editar`} className="text-sm font-medium text-[var(--cs)] hover:text-[var(--cp)] truncate block">{p.nombre}</Link>
          <p className="text-xs text-[#5F6B7A]">
            {p.codigo || 'Sin código'} · Stock {p.stock}{p.created_at ? ` · creado ${formatDate(p.created_at)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end shrink-0">
          {p.pendientes.map(m => (
            <span key={m} className="text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-600/20 rounded-full px-2 py-0.5">{m}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {falta('Sin código') && (
          <div className="flex gap-1.5">
            <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Código"
              onKeyDown={e => e.key === 'Enter' && enviar('codigo', codigo)} className={inputCls} />
            <BotonOk onClick={() => enviar('codigo', codigo)} disabled={!codigo.trim() || ocupado} cargando={guardar.isPending} />
          </div>
        )}

        {falta('Sin categoría') && (
          <select defaultValue="" disabled={ocupado}
            onChange={e => e.target.value && guardar.mutate({ categoria_ids: [Number(e.target.value)] })}
            className={inputCls}>
            <option value="" disabled>Elegir categoría…</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}

        {falta('Sin costo') && (
          <div className="flex gap-1.5">
            <input type="number" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} placeholder="Costo"
              onKeyDown={e => e.key === 'Enter' && enviar('costo', costo, Number)} className={inputCls} />
            <BotonOk onClick={() => enviar('costo', costo, Number)} disabled={!(Number(costo) > 0) || ocupado} cargando={guardar.isPending} />
          </div>
        )}

        {falta('Sin precio de venta') && (
          <div className="flex gap-1.5">
            <input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Precio de venta"
              onKeyDown={e => e.key === 'Enter' && enviar('precio_venta', precio, Number)} className={inputCls} />
            <BotonOk onClick={() => enviar('precio_venta', precio, Number)} disabled={!(Number(precio) > 0) || ocupado} cargando={guardar.isPending} />
          </div>
        )}

        {falta('Nombre duplicado') && (
          renombrando ? (
            <div className="flex gap-1.5 sm:col-span-2">
              <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && nombre.trim() !== p.nombre && enviar('nombre', nombre)} className={inputCls} />
              <BotonOk onClick={() => enviar('nombre', nombre)} disabled={!nombre.trim() || nombre.trim() === p.nombre || ocupado} cargando={guardar.isPending} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 sm:col-span-2 lg:col-span-4">
              {duplicados.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--cp)]/30 bg-[var(--cp-10)] pl-2.5 pr-1 py-0.5">
                  <Merge size={12} className="text-[var(--cp)] shrink-0" />
                  <select value="" disabled={ocupado}
                    onChange={e => setUnirCon(duplicados.find(d => d.id === Number(e.target.value)) ?? null)}
                    className="bg-transparent text-xs font-medium text-[var(--cs)] py-1 focus:outline-none">
                    <option value="" disabled>Unir con…</option>
                    {duplicados.map(d => (
                      <option key={d.id} value={d.id}>{etiqueta(d)} · stock {d.stock}</option>
                    ))}
                  </select>
                </div>
              )}
              <button type="button" onClick={() => setRenombrando(true)} disabled={ocupado}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-[var(--cs)] hover:border-[var(--cp)] hover:text-[var(--cp)] transition-colors">
                <Pencil size={12} /> Es otro producto: renombrar
              </button>
              {p.stock <= 0 && (
                <button type="button" onClick={() => setConfirmarBaja(true)} disabled={ocupado}
                  className="flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                  <PowerOff size={12} /> Sobra: desactivar
                </button>
              )}
            </div>
          )
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Modal open={confirmarBaja} onClose={() => !desactivar.isPending && setConfirmarBaja(false)} title="Desactivar producto duplicado" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--cs)]">
            Se desactivará <strong>{p.nombre}</strong>{p.codigo ? ` (${p.codigo})` : ''} y dejará de aparecer en listas y ventas.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmarBaja(false)} disabled={desactivar.isPending} className="flex-1">Cancelar</Button>
            <Button type="button" onClick={() => desactivar.mutate()} loading={desactivar.isPending} className="flex-1">Desactivar</Button>
          </div>
        </div>
      </Modal>

      {unirCon && (
        <Modal open onClose={() => !unir.isPending && setUnirCon(null)} title="Unir productos duplicados" size="sm">
          <ResumenUnion origen={p} destino={unirCon} />
          <div className="flex gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={() => setUnirCon(null)} disabled={unir.isPending} className="flex-1">Cancelar</Button>
            <Button type="button" onClick={() => unir.mutate(unirCon)} loading={unir.isPending} className="flex-1">Unir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ResumenUnion({ origen, destino }: { origen: ProductoPendiente; destino: ProductoPendiente }) {
  const costo     = costoUnion(origen.stock, origen.costo, destino.stock, destino.costo)
  const tieneCod  = (c: string | null) => !!c && /[a-z0-9]/i.test(c)
  const pasaCodigo = !tieneCod(destino.codigo) && tieneCod(origen.codigo)
  const codigosDistintos = tieneCod(origen.codigo) && tieneCod(destino.codigo) && origen.codigo !== destino.codigo

  return (
    <div className="space-y-3 text-sm text-[var(--cs)]">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-gray-200 p-2.5">
          <p className="font-semibold text-red-600 mb-1">Se desactiva</p>
          <p className="font-medium">{etiqueta(origen)}</p>
          <p className="text-[#5F6B7A]">Stock {origen.stock} · costo {formatCurrency(origen.costo)}</p>
        </div>
        <div className="rounded-lg border border-[var(--cp)]/40 bg-[var(--cp-10)] p-2.5">
          <p className="font-semibold text-[var(--cp)] mb-1">Se conserva</p>
          <p className="font-medium">{etiqueta(destino)}</p>
          <p className="text-[#5F6B7A]">Stock {destino.stock} · costo {formatCurrency(destino.costo)}</p>
        </div>
      </div>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        {origen.stock > 0
          ? <li>Se pasan <strong>{origen.stock}</strong> unidades a {etiqueta(destino)}, en las mismas bodegas (queda registrado en movimientos de inventario). Stock final: <strong>{origen.stock + destino.stock}</strong>.</li>
          : <li>{etiqueta(origen)} no tiene stock que pasar.</li>}
        <li>Costo resultante: <strong>{formatCurrency(costo)}</strong>{origen.costo > 0 && destino.costo > 0 && origen.costo !== destino.costo ? ' (promedio ponderado por unidades)' : ''}.</li>
        {pasaCodigo && <li>{etiqueta(destino)} recibe el código <strong>{origen.codigo}</strong>.</li>}
        <li>Los datos vacíos de {etiqueta(destino)} (categoría, precio, etc.) se completan con los de {etiqueta(origen)}.</li>
      </ul>
      {codigosDistintos && (
        <p className="text-xs rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-amber-800">
          Tienen códigos distintos ({origen.codigo} y {destino.codigo}). Confirma que es el mismo producto; si son variantes distintas, usa “renombrar”.
        </p>
      )}
    </div>
  )
}
