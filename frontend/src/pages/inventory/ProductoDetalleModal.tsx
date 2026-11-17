import { useQuery } from '@tanstack/react-query'
import { ImageOff, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { existenciasApi, productosApi } from '@/api/recursos'
import { usePermisos } from '@/lib/permisos'
import { formatCurrency, formatNumber, imgUrl } from '@/lib/utils'
import type { Existencia } from '@/types'

interface Props {
  productoId: number | null
  empresaId: number
  onClose: () => void
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">{label}</p>
      <p className="text-sm text-[var(--cs)] font-medium mt-0.5">{children}</p>
    </div>
  )
}

/** Ficha rápida del producto: foto grande, datos generales y stock por bodega. */
export default function ProductoDetalleModal({ productoId, empresaId, onClose }: Props) {
  const { hasPerm } = usePermisos()
  const open = productoId != null

  const { data: producto, isLoading } = useQuery({
    queryKey: ['producto', productoId],
    queryFn:  () => productosApi.get(productoId!).then(r => r.data.data),
    enabled:  open,
  })

  const { data: existencias } = useQuery({
    queryKey: ['existencias-producto', empresaId, productoId],
    queryFn:  () => existenciasApi.list({ empresa_id: empresaId, producto_id: productoId, per_page: 100 })
      .then(r => r.data.data as Existencia[]),
    enabled:  open,
  })

  const foto = imgUrl(producto?.imagen_url)
  const conStock = (existencias ?? []).filter(e => Number(e.cantidad) !== 0)
  const stockTotal = conStock.reduce((s, e) => s + Number(e.cantidad_disponible ?? e.cantidad), 0)
  const tasa = producto?.tasa_isv
  const unidad = producto?.unidad_medida?.abreviatura ?? producto?.unidad_medida?.nombre
  const medidas = [producto?.largo, producto?.ancho, producto?.alto].some(v => v != null)
    ? [producto?.largo, producto?.ancho, producto?.alto].map(v => v ?? '—').join(' × ')
    : null

  return (
    <Modal open={open} onClose={onClose} title={producto?.nombre ?? 'Producto'} size="xl">
      {isLoading || !producto ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Foto */}
          <div className="aspect-square w-full rounded-xl border border-gray-100 bg-[#F4F7FA] overflow-hidden flex items-center justify-center">
            {foto
              ? <img src={foto} alt={producto.nombre} className="w-full h-full object-contain" />
              : <div className="flex flex-col items-center gap-2 text-gray-300"><ImageOff size={48} /><span className="text-sm">Sin foto</span></div>}
          </div>

          {/* Información */}
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {producto.codigo && <span className="text-xs font-mono text-[#5F6B7A]">{producto.codigo}</span>}
                {!producto.activo && <Badge variant="gray">Inactivo</Badge>}
              </div>
              {producto.descripcion && <p className="text-sm text-[#5F6B7A] mt-1">{producto.descripcion}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Dato label="Precio de venta">
                {formatCurrency(Number(producto.precio_venta))}
                <span className="block text-[11px] text-[#5F6B7A] font-normal">
                  {tasa === 0 ? 'Exento de ISV' : producto.precio_incluye_isv ? 'ISV incluido' : '+ ISV'}
                </span>
              </Dato>
              {hasPerm('ver_costos') && <Dato label="Costo">{formatCurrency(Number(producto.costo))}</Dato>}
              <Dato label="Categoría">{producto.categorias?.map(c => c.nombre).join(', ') || '—'}</Dato>
              <Dato label="Marca">{producto.marca?.nombre ?? '—'}</Dato>
              <Dato label="Unidad">{producto.unidad_medida?.nombre ?? '—'}</Dato>
              {producto.codigo_barra && <Dato label="Código de barras"><span className="font-mono">{producto.codigo_barra}</span></Dato>}
              {producto.tamaño && <Dato label="Tamaño">{producto.tamaño}</Dato>}
              {medidas && <Dato label="Medidas (L × A × Al)">{medidas}</Dato>}
              {producto.peso != null && <Dato label="Peso">{formatNumber(Number(producto.peso))}</Dato>}
            </div>

            {/* Stock por bodega */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#F4F7FA]">
                <span className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Stock</span>
                <span className="text-sm font-bold text-[var(--cs)]">
                  {formatNumber(stockTotal)} {unidad ?? ''}
                </span>
              </div>
              {conStock.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#5F6B7A]">Sin existencias.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {conStock.map(e => (
                    <li key={e.id} className="flex justify-between px-4 py-2 text-sm">
                      <span className="text-[#5F6B7A]">{e.bodega?.nombre ?? 'Sin asignar'}{e.lote ? ` · Lote ${e.lote}` : ''}</span>
                      <span className="font-semibold text-[var(--cs)]">{formatNumber(Number(e.cantidad_disponible ?? e.cantidad))}</span>
                    </li>
                  ))}
                </ul>
              )}
              {Number(producto.stock_minimo) > 0 && (
                <p className="px-4 py-2 text-[11px] text-[#5F6B7A] border-t border-gray-100">
                  Stock mínimo: {formatNumber(Number(producto.stock_minimo))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
