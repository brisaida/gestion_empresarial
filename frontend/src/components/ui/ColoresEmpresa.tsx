import type { CSSProperties, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { empresaApi } from '@/api/recursos'

/**
 * Aplica los colores de la empresa (--cp / --cs) solo a su contenido.
 * La interfaz general mantiene los colores por defecto; esto se usa en
 * reportes para que se vean con la identidad de la empresa.
 * `display: contents` evita que el envoltorio afecte el layout.
 */
export default function ColoresEmpresa({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const { data: empresa } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
    staleTime: 5 * 60_000,
  })

  const style = {
    ...(empresa?.color_primario   && { '--cp': empresa.color_primario }),
    ...(empresa?.color_secundario && { '--cs': empresa.color_secundario }),
  } as CSSProperties

  return <div className="contents" style={style}>{children}</div>
}
