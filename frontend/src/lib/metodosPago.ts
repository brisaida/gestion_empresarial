import type { MetodoPagoCompra } from '@/types'

export const METODO_COMPRA_LABEL: Record<MetodoPagoCompra, string> = {
  efectivo: 'Efectivo', debito: 'Débito', tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia', cheque: 'Cheque',
}
