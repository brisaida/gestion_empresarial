import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { bancosApi } from '@/api/recursos'
import { usePermisos } from '@/lib/permisos'

/** Selector de tarjeta de crédito de la empresa (solo activas). */
export default function TarjetaSelect({ empresaId, value, onChange, label = 'Tarjeta de crédito *', className }: {
  empresaId: number
  value: string
  onChange: (v: string) => void
  label?: string
  className?: string
}) {
  const { data: tarjetas = [], isLoading } = useQuery({
    queryKey: ['tarjetas', 'opciones', empresaId],
    queryFn:  () => bancosApi.opcionesTarjetas(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 60_000,
  })

  const { hasPerm } = usePermisos()
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={isLoading}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]">
        <option value="">— Seleccionar —</option>
        {tarjetas.map(t => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
      </select>
      {!isLoading && tarjetas.length === 0 && (
        <p className="text-[11px] text-amber-700 mt-1">
          No hay tarjetas registradas.{' '}
          {hasPerm('finanzas') ? <Link to="/tarjetas-credito" className="font-semibold underline">Agrégalas aquí</Link> : 'Pide que las registren en Finanzas.'}
        </p>
      )}
    </div>
  )
}
