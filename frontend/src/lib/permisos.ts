import { useAuth } from '@/stores/authStore'

export function usePermisos() {
  const { state } = useAuth()
  const esSuperAdmin = state.usuario?.es_super_admin ?? false
  const modulos = state.empresaActiva?.modulos ?? null

  // true si:
  //   - es super admin
  //   - el rol no tiene restricciones (modulos === null)
  //   - el módulo está en la lista
  const hasPerm = (modulo: string): boolean => {
    if (esSuperAdmin) return true
    if (modulos === null) return true
    return modulos.includes(modulo)
  }

  return { hasPerm, esSuperAdmin }
}
