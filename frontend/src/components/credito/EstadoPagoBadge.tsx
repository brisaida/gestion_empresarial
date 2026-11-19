import Badge from '@/components/ui/Badge'
import type { Venta } from '@/types'

/** Estado de cobro de una venta al crédito: al día, vencida (con días) o pagada. */
export default function EstadoPagoBadge({ venta }: { venta: Pick<Venta, 'estado_pago' | 'dias_vencida'> }) {
  switch (venta.estado_pago) {
    case 'pagada':    return <Badge variant="green">Pagada</Badge>
    case 'vencida':   return <Badge variant="red">Vencida{venta.dias_vencida ? ` · ${venta.dias_vencida} d` : ''}</Badge>
    case 'pendiente': return <Badge variant="yellow">Por cobrar</Badge>
    case 'cancelada': return <Badge variant="gray">Cancelada</Badge>
    default:          return null
  }
}
