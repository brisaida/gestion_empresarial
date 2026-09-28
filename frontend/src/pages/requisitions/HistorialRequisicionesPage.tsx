import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, CheckCircle, XCircle, RotateCcw, Download, Loader2, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { requisicionesApi, empresaApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import SearchBar from '@/components/ui/SearchBar'
import Button from '@/components/ui/Button'
import AutorizarModal from '@/components/ui/AutorizarModal'
import { usePermisos } from '@/lib/permisos'
import { getAxiosError } from '@/lib/utils'
import { printRequisicion } from '@/lib/printRequisicion'
import type { Requisicion, EstadoRequisicion } from '@/types'

const estadoConfig: Record<EstadoRequisicion, { label: string; cls: string }> = {
  borrador:  { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600' },
  enviada:   { label: 'Enviada',   cls: 'bg-blue-50 text-blue-700' },
  recibida:  { label: 'Recibida',  cls: 'bg-emerald-50 text-emerald-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 text-red-700' },
}

const acciones: Partial<Record<EstadoRequisicion, { estado: EstadoRequisicion; label: string; icon: React.ReactNode; cls: string }[]>> = {
  borrador: [
    { estado: 'enviada',   label: 'Marcar enviada', icon: <Send size={13} />,        cls: 'text-[var(--cp)] hover:bg-[var(--cp)]/10' },
    { estado: 'cancelada', label: 'Cancelar',       icon: <XCircle size={13} />,     cls: 'text-red-600 hover:bg-red-50' },
  ],
  enviada: [
    { estado: 'recibida',  label: 'Recibida',       icon: <CheckCircle size={13} />, cls: 'text-emerald-600 hover:bg-emerald-50' },
    { estado: 'borrador',  label: 'Revertir',       icon: <RotateCcw size={13} />,   cls: 'text-gray-500 hover:bg-gray-100' },
    { estado: 'cancelada', label: 'Cancelar',       icon: <XCircle size={13} />,     cls: 'text-red-600 hover:bg-red-50' },
  ],
}

export default function HistorialRequisicionesPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [estado, setEstado]     = useState('')
  const [error, setError]       = useState('')
  const [printing, setPrinting] = useState<number | null>(null)
  const [autorizarReq, setAutorizarReq] = useState<Requisicion | null>(null)
  const { hasPerm } = usePermisos()

  const { data, isLoading } = useQuery({
    queryKey: ['requisiciones', empresaId, page, search, estado],
    queryFn:  () => requisicionesApi.list({ empresa_id: empresaId, page, search: search || undefined, estado: estado || undefined }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => requisicionesApi.cambiarEstado(id, estado),
    onSuccess: () => { setError(''); qc.invalidateQueries({ queryKey: ['requisiciones'] }) },
    onError: (err) => setError(getAxiosError(err)),
  })

  const imprimir = async (req: Requisicion) => {
    const id = req.id
    setPrinting(id)
    try {
      const [reqRes, empresaRes, logoRes, firmaRes] = await Promise.all([
        requisicionesApi.get(id),
        empresaApi.get(empresaId),
        empresaApi.logoBase64(empresaId),
        req.autorizado ? requisicionesApi.firma(id) : Promise.resolve(null),
      ])
      await printRequisicion(reqRes.data.data, empresaRes.data.data, logoRes.data.data.logo_base64 ?? undefined, firmaRes?.data.data)
    } catch (err) {
      setError(getAxiosError(err))
    } finally {
      setPrinting(null)
    }
  }

  const columns: Column<Requisicion>[] = [
    { key: 'numero', header: 'N° pedido', cell: r => <span className="font-bold text-[var(--cp)]">{r.numero_requisicion}</span> },
    { key: 'fecha', header: 'Fecha', cell: r => r.fecha_requisicion },
    { key: 'proveedor', header: 'Proveedor', cell: r => r.proveedor?.nombre ?? <span className="text-gray-400">—</span> },
    { key: 'realizado', header: 'Realizado por', cell: r => r.realizado_por ?? '—' },
    { key: 'articulos', header: 'Artículos', align: 'center', cell: r => r.total_articulos ?? '—' },
    {
      key: 'estado', header: 'Estado', cell: r => {
        const { label, cls } = estadoConfig[r.estado]
        return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
      },
    },
    {
      key: 'acciones', header: '', align: 'right', cell: r => (
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {(acciones[r.estado] ?? []).map(a => (
            <button key={a.estado} type="button" disabled={cambiarEstado.isPending}
              onClick={() => cambiarEstado.mutate({ id: r.id, estado: a.estado })}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${a.cls}`}>
              {a.icon} {a.label}
            </button>
          ))}
          {r.autorizado ? (
            <span title={`Autorizada por ${r.autorizado_por ?? ''}`} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-600">
              <ShieldCheck size={13} /> Autorizada
            </span>
          ) : hasPerm('firmar') && r.estado !== 'cancelada' && (
            <button type="button" onClick={() => setAutorizarReq(r)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors">
              <ShieldCheck size={13} /> Autorizar
            </button>
          )}
          {r.estado === 'borrador' && !r.autorizado && (
            <button type="button" title="Editar" onClick={() => navigate(`/requisiciones/${r.id}/editar`)}
              className="p-1.5 rounded-lg text-[#5F6B7A] hover:text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors">
              <Pencil size={14} />
            </button>
          )}
          <button type="button" title="Descargar / imprimir" onClick={() => imprimir(r)} disabled={printing === r.id}
            className="p-1.5 rounded-lg text-[#5F6B7A] hover:text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors">
            {printing === r.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--cs)]">Requisiciones</h1>
          <p className="text-sm text-[#5F6B7A]">Pedidos de mercadería enviados a proveedores</p>
        </div>
        <Button icon={<Plus size={15} />} onClick={() => navigate('/requisiciones')}>Nueva requisición</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-100">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Buscar por N° de pedido..." className="flex-1" />
          <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]">
            <option value="">Todos los estados</option>
            {Object.entries(estadoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {error && <p className="mx-4 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay requisiciones." />
        {data?.meta && (
          <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
        )}
      </div>

      <AutorizarModal
        open={autorizarReq !== null}
        onClose={() => setAutorizarReq(null)}
        documento={`requisición ${autorizarReq?.numero_requisicion ?? ''}`}
        onAutorizar={async pin => {
          await requisicionesApi.autorizar(autorizarReq!.id, pin)
          qc.invalidateQueries({ queryKey: ['requisiciones'] })
        }}
      />
    </div>
  )
}
