import { useState } from 'react'
import { ArrowRightCircle, CheckCircle, XCircle, Send, RotateCcw, Download, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { cotizacionesApi, bodegasApi } from '@/api/recursos'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import { formatCurrency, getAxiosError } from '@/lib/utils'
import type { Cotizacion, EstadoCotizacion } from '@/types'

/* ── Badge de estado ─────────────────────────────────────────── */
const estadoConfig: Record<EstadoCotizacion, { label: string; cls: string }> = {
  borrador:   { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
  enviada:    { label: 'Enviada',     cls: 'bg-blue-50 text-blue-700' },
  aprobada:   { label: 'Aprobada',   cls: 'bg-emerald-50 text-emerald-700' },
  rechazada:  { label: 'Rechazada',  cls: 'bg-red-50 text-red-700' },
  convertida: { label: 'Convertida', cls: 'bg-purple-50 text-purple-700' },
  vencida:    { label: 'Vencida',    cls: 'bg-amber-50 text-amber-700' },
}

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  const { label, cls } = estadoConfig[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

/* ── Transiciones válidas ────────────────────────────────────── */
const acciones: Record<string, { estado: string; label: string; icon: React.ReactNode; variant?: 'danger' | 'secondary' }[]> = {
  borrador: [{ estado: 'enviada',   label: 'Marcar enviada', icon: <Send size={13} /> }],
  enviada:  [
    { estado: 'aprobada',  label: 'Aprobar',  icon: <CheckCircle size={13} /> },
    { estado: 'rechazada', label: 'Rechazar', icon: <XCircle size={13} />,    variant: 'danger' },
    { estado: 'borrador',  label: 'Revertir', icon: <RotateCcw size={13} />,  variant: 'secondary' },
  ],
  aprobada: [{ estado: 'rechazada', label: 'Rechazar', icon: <XCircle size={13} />, variant: 'danger' }],
}

/* ── Descarga PDF (lazy — carga la librería solo cuando se necesita) ── */
async function descargarPDF(cot: Cotizacion, empresaNombre: string) {
  // Importaciones dinámicas para no inflar el bundle principal
  const [{ pdf }, { default: CotizacionPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/CotizacionPDF'),
  ])
  const blob = await pdf(<CotizacionPDF cotizacion={cot} empresaNombre={empresaNombre} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${cot.numero_cotizacion}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistorialCotizacionesPage() {
  const { state } = useAuth()
  const empresaId    = state.empresaActiva?.id ?? 0
  const empresaNombre = state.empresaActiva?.nombre ?? 'Mi empresa'
  const qc = useQueryClient()

  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [loadingPdf, setLoadingPdf] = useState<number | null>(null)

  /* modal estado */
  const [estadoModal, setEstadoModal]   = useState<{ cot: Cotizacion; nuevoEstado: string; label: string } | null>(null)
  const [estadoError, setEstadoError]   = useState('')

  /* modal convertir */
  const [convertirCot, setConvertirCot] = useState<Cotizacion | null>(null)
  const [bodegaId, setBodegaId]         = useState('')
  const [convertirError, setConvertirError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', empresaId, page, search],
    queryFn:  () => cotizacionesApi.list({ empresa_id: empresaId, page, per_page: 15, search: search || undefined }).then(r => r.data),
    enabled:  empresaId > 0,
    placeholderData: p => p,
  })

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-all', empresaId],
    queryFn:  () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => cotizacionesApi.cambiarEstado(id, estado),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cotizaciones'] }); setEstadoModal(null); setEstadoError('') },
    onError: (err) => setEstadoError(getAxiosError(err)),
  })

  const convertir = useMutation({
    mutationFn: ({ id, bodega_id }: { id: number; bodega_id: number }) =>
      cotizacionesApi.convertir(id, { bodega_id, fecha_venta: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['existencias'] })
      setConvertirCot(null); setBodegaId(''); setConvertirError('')
    },
    onError: (err) => setConvertirError(getAxiosError(err)),
  })

  /* ── Botón PDF: carga el detalle completo antes de generar ── */
  const handlePdf = async (cot: Cotizacion) => {
    setLoadingPdf(cot.id)
    try {
      // Si ya tiene detalles cargados los usa, si no los pide
      let full = cot
      if (!cot.detalles) {
        const res = await cotizacionesApi.get(cot.id)
        full = res.data.data
      }
      await descargarPDF(full, empresaNombre)
    } finally {
      setLoadingPdf(null)
    }
  }

  const columns: Column<Cotizacion>[] = [
    {
      key: 'numero_cotizacion', header: 'N° Cotización',
      cell: r => <span className="font-mono text-sm font-bold text-[#0E78D8]">{r.numero_cotizacion}</span>,
      width: '130px',
    },
    {
      key: 'cliente', header: 'Cliente',
      cell: r => <span className="font-semibold text-[#072B5A]">{r.cliente?.nombre ?? '— Sin cliente —'}</span>,
    },
    {
      key: 'fecha_cotizacion', header: 'Fecha',
      cell: r => <span className="text-[#5F6B7A]">{r.fecha_cotizacion}</span>,
      align: 'center',
    },
    {
      key: 'fecha_vencimiento', header: 'Vence',
      cell: r => r.fecha_vencimiento
        ? <span className={`text-sm ${new Date(r.fecha_vencimiento) < new Date() && r.estado !== 'convertida' ? 'text-red-500 font-medium' : 'text-[#5F6B7A]'}`}>{r.fecha_vencimiento}</span>
        : <span className="text-gray-300">—</span>,
      align: 'center',
    },
    {
      key: 'total', header: 'Total',
      cell: r => <span className="font-bold text-[#072B5A]">{formatCurrency(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'estado', header: 'Estado',
      cell: r => <EstadoBadge estado={r.estado} />,
      align: 'center', width: '110px',
    },
    {
      key: 'acciones', header: '', align: 'right', width: '220px',
      cell: r => (
        <div className="flex items-center justify-end gap-1 flex-wrap">

          {/* Botón PDF */}
          <button
            onClick={() => handlePdf(r)}
            disabled={loadingPdf === r.id}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#5F6B7A] hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Descargar PDF"
          >
            {loadingPdf === r.id
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />
            }
            PDF
          </button>

          {/* Botones de cambio de estado */}
          {(acciones[r.estado] ?? []).map(acc => (
            <button key={acc.estado}
              onClick={() => { setEstadoModal({ cot: r, nuevoEstado: acc.estado, label: acc.label }); setEstadoError('') }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                acc.variant === 'danger'    ? 'text-red-600 hover:bg-red-50' :
                acc.variant === 'secondary' ? 'text-[#5F6B7A] hover:bg-gray-100' :
                'text-[#0E78D8] hover:bg-[#0E78D8]/8'
              }`}>
              {acc.icon}{acc.label}
            </button>
          ))}

          {/* Convertir a venta */}
          {r.estado === 'aprobada' && (
            <button
              onClick={() => { setConvertirCot(r); setBodegaId(''); setConvertirError('') }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <ArrowRightCircle size={13} /> Convertir
            </button>
          )}

          {r.estado === 'convertida' && r.venta_id && (
            <span className="text-xs text-purple-500 font-medium">Venta #{r.venta_id}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-[#072B5A]">Historial de Cotizaciones</h1>
        <p className="text-sm text-[#5F6B7A]">Gestiona y da seguimiento a tus propuestas</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Buscar por N° cotización..." className="max-w-sm" />
        </div>
        <Table columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No hay cotizaciones registradas." />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
      </div>

      {/* Modal cambiar estado */}
      <Modal open={estadoModal !== null} onClose={() => setEstadoModal(null)} title="Cambiar estado" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          ¿Confirmar cambio de <strong>{estadoModal?.cot.numero_cotizacion}</strong> a{' '}
          <strong>{estadoConfig[estadoModal?.nuevoEstado as EstadoCotizacion]?.label ?? estadoModal?.nuevoEstado}</strong>?
        </p>
        {estadoError && <p className="mb-4 text-sm text-red-600">{estadoError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEstadoModal(null)}>Cancelar</Button>
          <Button
            loading={cambiarEstado.isPending}
            variant={estadoModal?.nuevoEstado === 'rechazada' ? 'danger' : 'primary'}
            onClick={() => estadoModal && cambiarEstado.mutate({ id: estadoModal.cot.id, estado: estadoModal.nuevoEstado })}>
            {estadoModal?.label}
          </Button>
        </div>
      </Modal>

      {/* Modal convertir a venta */}
      <Modal open={convertirCot !== null} onClose={() => setConvertirCot(null)} title="Convertir a venta" size="sm">
        <p className="text-sm text-[#5F6B7A] mb-4">
          Se creará una venta desde <strong>{convertirCot?.numero_cotizacion}</strong> y se descontará el stock.
          Selecciona la bodega de despacho:
        </p>
        <select value={bodegaId} onChange={e => setBodegaId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#072B5A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] mb-4">
          <option value="">Seleccionar bodega *</option>
          {bodegas?.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        {convertirError && <p className="mb-4 text-sm text-red-600">{convertirError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConvertirCot(null)}>Cancelar</Button>
          <Button loading={convertir.isPending} disabled={!bodegaId} icon={<ArrowRightCircle size={15} />}
            onClick={() => convertirCot && convertir.mutate({ id: convertirCot.id, bodega_id: Number(bodegaId) })}>
            Convertir a venta
          </Button>
        </div>
      </Modal>
    </div>
  )
}
