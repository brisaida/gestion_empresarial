import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer, Undo2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { comprasApi, empresaApi, ventasApi } from '@/api/recursos'
import { printDevolucion } from '@/lib/printCredito'
import CuentaSelect from '@/components/tarjetas/CuentaSelect'
import { formatoNumeroFactura } from '@/lib/printVenta'
import { formatCurrency, getAxiosError, todayISO, cn } from '@/lib/utils'
import type { Compra, DevolucionCompra, DevolucionVenta, ReembolsoMetodo, Venta } from '@/types'

/**
 * Devolución parcial o total.
 * - tipo 'venta': el cliente devuelve productos (regresan a la bodega).
 * - tipo 'compra': se devuelven productos al proveedor (salen de la bodega).
 */
export interface DevolucionDestino { tipo: 'venta' | 'compra'; id: number }

interface Linea { id: number; nombre: string; codigo?: string | null; vendido: number; devuelto: number; precio: number }

const METODOS: Record<'venta' | 'compra', { value: ReembolsoMetodo; label: string }[]> = {
  venta: [
    { value: 'efectivo', label: 'Efectivo' }, { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta' }, { value: 'cambio', label: 'Cambio / saldo a favor' },
  ],
  compra: [
    { value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' },
    { value: 'cambio', label: 'Reposición / nota a favor' },
  ],
}

export default function DevolucionModal({ destino, empresaId, onClose }: { destino: DevolucionDestino | null; empresaId: number; onClose: () => void }) {
  return (
    <Modal open={!!destino} onClose={onClose} title={destino?.tipo === 'compra' ? 'Devolución a proveedor' : 'Devolución de cliente'} size="lg">
      {destino && <Cargador key={`${destino.tipo}${destino.id}`} destino={destino} empresaId={empresaId} onClose={onClose} />}
    </Modal>
  )
}

function Cargador({ destino, empresaId, onClose }: { destino: DevolucionDestino; empresaId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['devolucion-doc', destino.tipo, destino.id],
    queryFn: () => destino.tipo === 'venta'
      ? ventasApi.get(destino.id).then(r => r.data.data as Venta | Compra)
      : comprasApi.get(destino.id).then(r => r.data.data as Venta | Compra),
    staleTime: 0,
  })
  if (isLoading || !data) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
  return <Formulario tipo={destino.tipo} doc={data} empresaId={empresaId} onClose={onClose} />
}

function Formulario({ tipo, doc, empresaId, onClose }: { tipo: 'venta' | 'compra'; doc: Venta | Compra; empresaId: number; onClose: () => void }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const esVenta = tipo === 'venta'

  const lineas: Linea[] = esVenta
    ? ((doc as Venta).detalles ?? []).map(d => ({
        id: d.id, nombre: d.producto ?? d.descripcion ?? 'Producto', codigo: d.codigo,
        vendido: d.cantidad, devuelto: d.cantidad_devuelta ?? 0, precio: d.precio_unitario,
      }))
    : ((doc as Compra).detalles ?? []).map(d => ({
        id: d.id, nombre: d.producto?.nombre ?? 'Producto', codigo: d.producto?.codigo,
        vendido: d.cantidad, devuelto: d.cantidad_devuelta ?? 0, precio: d.costo_unitario,
      }))

  const [cant, setCant]       = useState<Record<number, string>>({})
  const [motivo, setMotivo]   = useState('')
  const [fecha, setFecha]     = useState(todayISO())
  const [metodo, setMetodo]   = useState<ReembolsoMetodo | ''>('')
  const [desdeCaja, setCaja]  = useState(true)
  const [imprimir, setImp]    = useState(true)
  const [cuentaId, setCuenta] = useState('')
  const [error, setError]     = useState('')

  // Vista previa: mismo cálculo proporcional que el servidor
  const base     = lineas.reduce((s, l) => s + (Number(cant[l.id]) || 0) * l.precio, 0)
  const prop     = doc.subtotal > 0 ? base / doc.subtotal : 0
  const subtotal = base - doc.descuento * prop
  const impuesto = doc.impuesto * prop
  const total    = subtotal + impuesto
  const saldo    = doc.condicion === 'credito' ? (doc.saldo_pendiente ?? 0) : 0
  const aplicado = Math.min(total, saldo)
  const reembolso = Math.max(0, total - aplicado)
  const necesitaMetodo = reembolso > 0.004

  const guardar = useMutation({
    mutationFn: (): Promise<DevolucionVenta | DevolucionCompra> => {
      const payload = {
        motivo: motivo.trim(), fecha,
        reembolso_metodo: necesitaMetodo ? (metodo || null) : null,
        desde_caja: metodo === 'efectivo' && desdeCaja,
        cuenta_bancaria_id: (metodo === 'transferencia' || (esVenta && metodo === 'tarjeta')) && cuentaId ? Number(cuentaId) : null,
        lineas: lineas.filter(l => (Number(cant[l.id]) || 0) > 0).map(l => ({ detalle_id: l.id, cantidad: Number(cant[l.id]) })),
      }
      return esVenta
        ? ventasApi.devolver(doc.id, payload).then(r => r.data.data)
        : comprasApi.devolver(doc.id, payload).then(r => r.data.data)
    },
    onSuccess: async (dev) => {
      for (const k of ['ventas', 'compras', 'existencias', 'productos', 'productos-all', 'cxc', 'cxp', 'clientes-all', 'caja-actual', 'devoluciones', 'dashboard', 'tarjetas', 'cuentas-banco']) {
        qc.invalidateQueries({ queryKey: [k] })
      }
      toast.success(`Devolución ${dev.numero} registrada.`)
      onClose()
      if (imprimir) {
        try {
          const [emp, logo] = await Promise.all([empresaApi.get(empresaId), empresaApi.logoBase64(empresaId)])
          printDevolucion(dev, esVenta ? 'cliente' : 'proveedor', emp.data.data, logo.data.data.logo_base64 ?? undefined)
        } catch { /* el comprobante es opcional */ }
      }
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (base <= 0 && !lineas.some(l => (Number(cant[l.id]) || 0) > 0)) { setError('Indica cuántas unidades se devuelven.'); return }
    const pasa = lineas.find(l => (Number(cant[l.id]) || 0) > l.vendido - l.devuelto + 0.00005)
    if (pasa) { setError(`De ${pasa.nombre} solo se pueden devolver ${+(pasa.vendido - pasa.devuelto).toFixed(4)}.`); return }
    if (motivo.trim().length < 3) { setError('Escribe el motivo de la devolución.'); return }
    if (necesitaMetodo && !metodo) { setError(`Indica cómo se hace el reembolso de ${formatCurrency(reembolso)}.`); return }
    setError('')
    guardar.mutate()
  }

  // Si la compra se pagó con tarjeta de crédito, el proveedor puede reversar a la tarjeta
  const metodos = !esVenta && (doc as Compra).metodo_pago === 'tarjeta'
    ? [{ value: 'tarjeta' as ReembolsoMetodo, label: `A la tarjeta${(doc as Compra).tarjeta ? ` ••${(doc as Compra).tarjeta!.ultimos4}` : ''}` }, ...METODOS.compra]
    : METODOS[tipo]

  const parte = esVenta ? ((doc as Venta).cliente?.nombre ?? 'Consumidor final') : ((doc as Compra).proveedor?.nombre ?? '')
  const numero = esVenta ? formatoNumeroFactura(doc.numero_factura) : (doc.numero_factura ?? `#${doc.id}`)

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F4F7FA] border border-gray-100 text-sm">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--cs)] truncate">Factura {numero} · {parte}</p>
          <p className="text-xs text-[#5F6B7A]">
            Total {formatCurrency(doc.total)}{doc.condicion === 'credito' ? ` · al crédito, saldo ${formatCurrency(saldo)}` : ''}
            {(doc.monto_devuelto ?? 0) > 0 ? ` · ya devuelto ${formatCurrency(doc.monto_devuelto ?? 0)}` : ''}
          </p>
        </div>
      </div>

      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#F4F7FA] text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider">
          <div className="col-span-5">Producto</div>
          <div className="col-span-2 text-center">{esVenta ? 'Vendido' : 'Comprado'}</div>
          <div className="col-span-2 text-center">Disponible</div>
          <div className="col-span-3 text-center">A devolver</div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
          {lineas.map(l => {
            const disp = +(l.vendido - l.devuelto).toFixed(4)
            return (
              <div key={l.id} className={cn('grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm', disp <= 0 && 'opacity-50')}>
                <div className="col-span-5 min-w-0">
                  <p className="font-medium text-[var(--cs)] truncate">{l.nombre}</p>
                  <p className="text-[11px] text-[#5F6B7A]">
                    {l.codigo ? `${l.codigo} · ` : ''}{formatCurrency(l.precio)} c/u
                  </p>
                </div>
                <div className="col-span-2 text-center text-[#5F6B7A]">{l.vendido}</div>
                <div className="col-span-2 text-center font-semibold text-[var(--cs)]">{disp}</div>
                <div className="col-span-3 flex items-center gap-1 justify-center">
                  <input type="number" min="0" max={disp} step="any" disabled={disp <= 0}
                    value={cant[l.id] ?? ''} placeholder="0"
                    onChange={e => setCant(c => ({ ...c, [l.id]: e.target.value }))}
                    className="w-16 text-center rounded-lg border border-gray-200 py-1 text-sm text-[var(--cs)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30" />
                  {disp > 0 && (
                    <button type="button" onClick={() => setCant(c => ({ ...c, [l.id]: String(disp) }))}
                      className="text-[10px] font-semibold text-[var(--cp)] hover:underline">Todo</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Input label="Motivo *" value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder={esVenta ? 'Defectuoso, no le sirvió, cambio…' : 'Llegó dañado, producto equivocado…'} />
        </div>
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
      </div>

      {/* Liquidación */}
      <div className="rounded-xl border border-gray-100 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-[#5F6B7A]"><span>Subtotal (con descuento)</span><span>{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between text-[#5F6B7A]"><span>ISV</span><span>{formatCurrency(impuesto)}</span></div>
        <div className="flex justify-between font-bold text-[var(--cs)] pt-1.5 border-t border-gray-100"><span>Total devuelto</span><span>{formatCurrency(total)}</span></div>
        {aplicado > 0.004 && (
          <div className="flex justify-between text-orange-700">
            <span>{esVenta ? 'Se descuenta del saldo del cliente' : 'Se descuenta de lo que le debes'}</span><span>− {formatCurrency(aplicado)}</span>
          </div>
        )}
        {necesitaMetodo && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <span>{esVenta ? 'Reembolso al cliente' : 'Te reembolsa el proveedor'}</span><span>{formatCurrency(reembolso)}</span>
          </div>
        )}
      </div>

      {necesitaMetodo && (
        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1.5">
            {esVenta ? 'Cómo se le devuelve el dinero' : 'Cómo te lo devuelve el proveedor'}
          </label>
          <div className="flex flex-wrap gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
            {metodos.map(m => (
              <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                className={cn('flex-1 min-w-[110px] py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all',
                  metodo === m.value ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-[#5F6B7A] hover:text-[var(--cs)]')}>
                {m.label}
              </button>
            ))}
          </div>
          {metodo === 'efectivo' && (
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
              <input type="checkbox" checked={desdeCaja} onChange={e => setCaja(e.target.checked)} className="rounded accent-[var(--cp)]" />
              {esVenta ? 'Sale del efectivo de la caja (se resta en el cierre)' : 'Entra al efectivo de la caja (se suma en el cierre)'}
            </label>
          )}
          {(metodo === 'transferencia' || (esVenta && metodo === 'tarjeta')) && (
            <CuentaSelect empresaId={empresaId} value={cuentaId} onChange={setCuenta} className="mt-3"
              uso={esVenta && metodo === 'tarjeta' ? 'cuenta_tarjeta_id' : 'cuenta_pagos_id'}
              label={esVenta ? 'Cuenta de donde sale el reembolso' : 'Cuenta donde entra el reembolso'} />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none">
          <input type="checkbox" checked={imprimir} onChange={e => setImp(e.target.checked)} className="rounded accent-[var(--cp)]" />
          <Printer size={14} /> Imprimir comprobante
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={guardar.isPending} icon={<Undo2 size={14} />}>Registrar devolución</Button>
        </div>
      </div>
    </form>
  )
}
