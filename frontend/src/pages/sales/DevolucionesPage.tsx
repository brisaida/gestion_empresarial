import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { devolucionesApi, empresaApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import SearchBar from '@/components/ui/SearchBar'
import { useToast } from '@/components/ui/Toast'
import { printDevolucion } from '@/lib/printCredito'
import { formatoNumeroFactura } from '@/lib/printVenta'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { DevolucionCompra, DevolucionVenta } from '@/types'

type Tab = 'clientes' | 'proveedores'

const REEMBOLSO: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cambio: 'Cambio / a favor',
}

/** Historial de devoluciones: de clientes (menú Ventas) o a proveedores (menú Compras). */
export default function DevolucionesPage({ tipo }: { tipo: Tab }) {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const toast = useToast()
  const tab = tipo

  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [desde, setDesde]   = useState('')
  const [hasta, setHasta]   = useState('')

  const params = { empresa_id: empresaId, page, per_page: 20, search: search || undefined, fecha_desde: desde || undefined, fecha_hasta: hasta || undefined }

  const { data: deCli, isLoading: l1 } = useQuery({
    queryKey: ['devoluciones', 'clientes', params],
    queryFn:  () => devolucionesApi.ventas(params).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'clientes',
    placeholderData: p => p,
  })
  const { data: deProv, isLoading: l2 } = useQuery({
    queryKey: ['devoluciones', 'proveedores', params],
    queryFn:  () => devolucionesApi.compras(params).then(r => r.data),
    enabled:  empresaId > 0 && tab === 'proveedores',
    placeholderData: p => p,
  })

  const imprimir = async (id: number, tipo: Tab) => {
    try {
      const [dev, emp, logo] = await Promise.all([
        tipo === 'clientes' ? devolucionesApi.venta(id) : devolucionesApi.compra(id),
        empresaApi.get(empresaId), empresaApi.logoBase64(empresaId),
      ])
      printDevolucion(dev.data.data, tipo === 'clientes' ? 'cliente' : 'proveedor', emp.data.data, logo.data.data.logo_base64 ?? undefined)
    } catch { toast.error('No se pudo generar el comprobante.') }
  }

  const liquidacion = (d: DevolucionVenta | DevolucionCompra) => (
    <div className="text-xs leading-tight text-[#5F6B7A]">
      {d.aplicado_a_saldo > 0 && <p>Saldo − {formatCurrency(d.aplicado_a_saldo)}</p>}
      {d.reembolsado > 0 && <p>{REEMBOLSO[d.reembolso_metodo ?? ''] ?? 'Reembolso'} {formatCurrency(d.reembolsado)}{d.desde_caja ? ' (caja)' : ''}</p>}
    </div>
  )

  const base = <T extends DevolucionVenta | DevolucionCompra>(tipo: Tab, parte: (d: T) => string | undefined, factura: (d: T) => string): Column<T>[] => [
    { key: 'numero', header: 'N°', width: '110px', cell: d => <span className="font-mono text-sm font-bold text-purple-700">{d.numero}</span> },
    { key: 'fecha', header: 'Fecha', width: '100px', cell: d => <span className="text-[#5F6B7A]">{formatDate(d.fecha)}</span> },
    { key: 'parte', header: tipo === 'clientes' ? 'Cliente' : 'Proveedor', cell: d => <span className="font-semibold text-[var(--cs)]">{parte(d) ?? '—'}</span> },
    { key: 'factura', header: 'Factura', cell: d => <span className="font-mono text-xs text-[var(--cp)]">{factura(d)}</span> },
    { key: 'motivo', header: 'Motivo', cell: d => <span className="text-[#5F6B7A] line-clamp-2">{d.motivo}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: d => <span className="font-bold text-[var(--cs)]">{formatCurrency(d.total)}</span> },
    { key: 'liq', header: 'Liquidación', cell: liquidacion },
    { key: 'usuario', header: 'Registró', cell: d => <span className="text-xs text-[#5F6B7A]">{d.usuario ?? '—'}</span> },
    {
      key: 'acc', header: '', align: 'right', width: '50px',
      cell: d => <button onClick={() => imprimir(d.id, tipo)} title="Imprimir comprobante" className="p-1.5 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100"><Printer size={14} /></button>,
    },
  ]

  const colsCli  = base<DevolucionVenta>('clientes', d => d.cliente?.nombre ?? 'Consumidor final', d => formatoNumeroFactura(d.numero_factura))
  const colsProv = base<DevolucionCompra>('proveedores', d => d.proveedor?.nombre, d => d.numero_factura ?? `#${d.compra_id}`)

  const meta = tab === 'clientes' ? deCli?.meta : deProv?.meta

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">{tab === 'clientes' ? 'Devoluciones de clientes' : 'Devoluciones a proveedores'}</h1>
        <p className="text-sm text-[#5F6B7A]">
          {tab === 'clientes'
            ? 'Productos que los clientes devolvieron. Se registran desde Historial de ventas con el botón ↩️.'
            : 'Mercadería devuelta a proveedores. Se registra desde Historial de compras con el botón ↩️.'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-3 justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
            <span className="text-[#5F6B7A] text-sm">a</span>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)]" />
            <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="N°, factura o nombre..." className="w-56" />
          </div>
        </div>

        {tab === 'clientes'
          ? <Table columns={colsCli} data={deCli?.data ?? []} loading={l1} emptyMessage="No hay devoluciones de clientes." />
          : <Table columns={colsProv} data={deProv?.data ?? []} loading={l2} emptyMessage="No hay devoluciones a proveedores." />}
        {meta && <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} onPage={setPage} />}
      </div>
    </div>
  )
}
