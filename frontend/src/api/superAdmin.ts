import client from './client'
import type { ApiResponse, PaginatedResponse, SaDashboardData, EmpresaAdmin, UsuarioAdmin, RolSimple, RolAdmin, UsuarioEmpresaItem } from '@/types'

// ── Dashboard ─────────────────────────────────────────────────────────────
export const saDashboardApi = {
  get: () => client.get<ApiResponse<SaDashboardData>>('/sa/dashboard'),
}

// ── Empresas ──────────────────────────────────────────────────────────────
export const saEmpresasApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<EmpresaAdmin>>('/sa/empresas', { params }),

  create: (data: Partial<EmpresaAdmin>) =>
    client.post<ApiResponse<EmpresaAdmin>>('/sa/empresas', data),

  update: (id: number, data: Partial<EmpresaAdmin>) =>
    client.put<ApiResponse<EmpresaAdmin>>(`/sa/empresas/${id}`, data),

  toggle: (id: number) =>
    client.patch<ApiResponse<EmpresaAdmin>>(`/sa/empresas/${id}/toggle`),
}

// ── Usuarios ──────────────────────────────────────────────────────────────
export const saUsuariosApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<UsuarioAdmin>>('/sa/usuarios', { params }),

  create: (data: { nombre: string; correo: string; password: string; es_super_admin?: boolean }) =>
    client.post<ApiResponse<UsuarioAdmin>>('/sa/usuarios', data),

  update: (id: number, data: { nombre: string; correo: string; es_super_admin?: boolean; password?: string }) =>
    client.put<ApiResponse<UsuarioAdmin>>(`/sa/usuarios/${id}`, data),

  toggle: (id: number) =>
    client.patch<ApiResponse<UsuarioAdmin>>(`/sa/usuarios/${id}/toggle`),

  empresas: (id: number) =>
    client.get<ApiResponse<UsuarioEmpresaItem[]>>(`/sa/usuarios/${id}/empresas`),

  asignarEmpresa: (id: number, data: { empresa_id: number; rol_id: number }) =>
    client.post<ApiResponse<null>>(`/sa/usuarios/${id}/empresas`, data),

  cambiarRol: (usuarioId: number, empresaId: number, rolId: number) =>
    client.patch<ApiResponse<null>>(`/sa/usuarios/${usuarioId}/empresas/${empresaId}/rol`, { rol_id: rolId }),

  quitarEmpresa: (usuarioId: number, empresaId: number) =>
    client.delete<ApiResponse<null>>(`/sa/usuarios/${usuarioId}/empresas/${empresaId}`),
}

// ── Roles ─────────────────────────────────────────────────────────────────
export const saRolesApi = {
  list: () => client.get<ApiResponse<RolAdmin[]>>('/sa/roles'),
  create: (data: { nombre: string; descripcion?: string }) =>
    client.post<ApiResponse<RolAdmin>>('/sa/roles', data),
  update: (id: number, data: { nombre: string; descripcion?: string }) =>
    client.put<ApiResponse<RolAdmin>>(`/sa/roles/${id}`, data),
  remove: (id: number) =>
    client.delete<ApiResponse<null>>(`/sa/roles/${id}`),
}
