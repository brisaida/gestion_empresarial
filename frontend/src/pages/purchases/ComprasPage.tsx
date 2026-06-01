import { useState } from 'react'
import { Plus, Trash2, ShoppingCart, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comprasApi, proveedoresApi, bodegasApi, productosApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatCurrency, getAxiosError } from '@/lib/utils'

interface LineaItem { producto_id: string; cantidad: string; costo_unitario: string; lote: string; fecha_vencimiento: string }
const emptyLinea = (): LineaItem => ({ producto_id: '', cantidad: '', costo_unitario: '', lote: '', fecha_vencimiento: '' })

const inputCls = 'w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all'

export default function ComprasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [form, setForm] = useState({ proveedor_id: '', bodega_id: '', fecha_compra: new Date().toISOString().slice(0, 10), numero_factura: '', descuento: '', impuesto: '' })
  const [lineas, setLineas] = useState<LineaItem[]>([emptyLinea()])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: proveedores } = useQuery({ queryKey: ['proveedores-all', empresaId], queryFn: () => proveedoresApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas }     = useQuery({ queryKey: ['bodegas-all', empresaId],     queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),     enabled: empresaId > 0 })
  const { data: productos }   = useQuery({ queryKey: ['productos-all', empresaId],   queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data), enabled: empresaId > 0 })

  const crear = useMutation({
    mutationFn: (payload: unknown) => comprasApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      setForm({ proveedor_id: '', bodega_id: '', fecha_compra: new Date().toISOString().slice(0, 10), numero_factura: '', descuento: '', impuesto: '' })
      setLineas([emptyLinea()])
      setError('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const setLinea = (i: number, field: keyof LineaItem, value: string) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const subtotal = lineas.reduce((s, l) => s + (Number(l.cantidad) * Number(l.costo_unitario) || 0), 0)
  const total    = subtotal - (Number(form.descuento) || 0) + (Number(form.impuesto) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.proveedor_id || !form.bodega_id || !form.fecha_compra) { setError('Completa los campos requeridos.'); return }
    if (lineas.some(l => !l.producto_id || !l.cantidad || !l.costo_unitario)) { setError('Cada línea necesita producto, cantidad y costo unitario.'); return }
    try {
      await crear.mutateAsync({
        empresa_id:     empresaId,
        proveedor_id:   Number(form.proveedor_id),
        bodega_id:      Number(form.bodega_id),
        fecha_compra:   form.fecha_compra,
        numero_factura: form.numero_factura || null,
        descuento:      form.descuento ? Number(form.descuento) : 0,
        impuesto:       form.impuesto  ? Number(form.impuesto)  : 0,
        detalles: lineas.map(l => ({
          producto_id:       Number(l.producto_id),
          cantidad:          Number(l.cantidad),
          costo_unitario:    Number(l.costo_unitario),
          lote:              l.lote || null,
          fecha_vencimiento: l.fecha_vencimiento || null,
        })),
      })
    } catch {
      // onError handler sets the error state
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Nueva orden de compra</h1>
          <p className="text-sm text-[#5F6B7A]">Registra una compra a proveedor — queda como pendiente hasta que la recibas</p>
        </div>
        <Link to="/compras/historial">
          <Button variant="secondary" icon={<ClipboardList size={15} />}>Historial</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Encabezado */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-4">Información general</p>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Proveedor *"
              options={proveedores?.map(p => ({ value: p.id, label: p.nombre })) ?? []}
              placeholder="Seleccionar"
              value={form.proveedor_id}
              onChange={e => setForm(f => ({ ...f, proveedor_id: (e.target as HTMLSelectElement).value }))}
              required
            />
            <Select
              label="Bodega destino *"
              options={bodegas?.map(b => ({ value: b.id, label: b.nombre })) ?? []}
              placeholder="Seleccionar"
              value={form.bodega_id}
              onChange={e => setForm(f => ({ ...f, bodega_id: (e.target as HTMLSelectElement).value }))}
              required
            />
            <Input label="Fecha *" type="date" value={form.fecha_compra} onChange={e => setForm(f => ({ ...f, fecha_compra: e.target.value }))} required />
            <Input label="N° Factura proveedor" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FAC-001" />
            <Input label="Descuento" type="number" step="0.01" min="0" value={form.descuento} onChange={e => setForm(f => ({ ...f, descuento: e.target.value }))} placeholder="0.00" />
            <Input label="Impuesto / ISV" type="number" step="0.01" min="0" value={form.impuesto} onChange={e => setForm(f => ({ ...f, impuesto: e.target.value }))} placeholder="0.00" />
          </div>
        </div>

        {/* Líneas de productos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Productos</p>
            <button type="button" onClick={() => setLineas(p => [...p, emptyLinea()])}
              className="text-xs text-[#0E78D8] hover:text-[#072B5A] font-semibold flex items-center gap-1 transition-colors">
              <Plus size={13} /> Agregar línea
            </button>
          </div>

          <div className="space-y-2">
            {lineas.map((l, i) => {
              const prod = productos?.find(p => String(p.id) === l.producto_id)
              return (
                <div key={i} className="bg-[#F4F7FA] rounded-lg">
                  <div className="grid grid-cols-12 gap-2 items-end p-3">
                    <div className="col-span-4">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Producto *</p>}
                      <select value={l.producto_id} onChange={e => setLinea(i, 'producto_id', e.target.value)} required className={`${inputCls} text-[#072B5A]`}>
                        <option value="">Seleccionar</option>
                        {productos?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cantidad *</p>}
                      <input type="number" step="any" min="0.0001" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} required placeholder="0" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo unit. *</p>}
                      <input type="number" step="0.01" min="0" value={l.costo_unitario} onChange={e => setLinea(i, 'costo_unitario', e.target.value)} required placeholder="0.00" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Subtotal</p>}
                      <div className="px-2 py-2 text-sm font-semibold text-[#072B5A] bg-white border border-gray-100 rounded-lg">
                        {formatCurrency(Number(l.cantidad) * Number(l.costo_unitario) || 0)}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      {lineas.length > 1 && (
                        <button type="button" onClick={() => setLineas(p => p.filter((_, idx) => idx !== i))}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {prod && (prod.maneja_lote || prod.maneja_vencimiento) && (
                    <div className="flex gap-3 px-3 pb-3 -mt-1">
                      {prod.maneja_lote && (
                        <div className="w-40">
                          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Lote</p>
                          <input value={l.lote} onChange={e => setLinea(i, 'lote', e.target.value)} placeholder="LOT-001" className={inputCls} />
                        </div>
                      )}
                      {prod.maneja_vencimiento && (
                        <div className="w-44">
                          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Fecha vencimiento</p>
                          <input type="date" value={l.fecha_vencimiento} onChange={e => setLinea(i, 'fecha_vencimiento', e.target.value)} className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Totales */}
          <div className="mt-4 flex justify-end">
            <div className="bg-[#F4F7FA] rounded-xl p-4 min-w-56 space-y-1.5">
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Descuento</span><span className="font-medium text-red-500">− {formatCurrency(Number(form.descuento) || 0)}</span></div>
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Impuesto</span><span className="font-medium">{formatCurrency(Number(form.impuesto) || 0)}</span></div>
              <div className="flex justify-between text-base font-bold text-[#072B5A] pt-1.5 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {success && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              ✓ Orden registrada. Puedes recibirla desde el historial cuando llegue la mercancía.
            </div>
          )}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={crear.isPending} icon={<ShoppingCart size={15} />}>
              Registrar orden de compra
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
