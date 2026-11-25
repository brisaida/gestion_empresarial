import { useQuery } from '@tanstack/react-query'
import { bancosApi } from '@/api/recursos'
import type { DefectosBanco } from '@/types'

/**
 * Cuenta bancaria donde cae o de donde sale un pago. Vacío = la cuenta por defecto de la empresa
 * (si tiene). Si la empresa no tiene cuentas registradas no se muestra nada: el módulo es opcional.
 */
export default function CuentaSelect({ empresaId, value, onChange, uso, label = 'Cuenta bancaria', className }: {
  empresaId: number
  value: string
  onChange: (v: string) => void
  uso: keyof DefectosBanco
  label?: string
  className?: string
}) {
  const { data } = useQuery({
    queryKey: ['cuentas-banco', 'opciones', empresaId],
    queryFn:  () => bancosApi.opciones(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 60_000,
  })

  if (!data || data.cuentas.length === 0) return null
  const defecto = data.cuentas.find(c => c.id === data.defectos?.[uso])

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]">
        <option value="">{defecto ? `Por defecto: ${defecto.etiqueta}` : '— No registrar en bancos —'}</option>
        {data.cuentas.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
      </select>
    </div>
  )
}
