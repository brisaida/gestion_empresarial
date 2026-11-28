import client from './client'
import type { ApiResponse, AuthState, EmpresaResumen, Usuario } from '@/types'

export const authApi = {
  login: (correo: string, password: string) =>
    client.post<ApiResponse<Omit<AuthState, 'empresaActiva'> & { token: string; usuario: Usuario }>>('/auth/login', { correo, password }),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<ApiResponse<Usuario>>('/auth/me'),

  empresas: () => client.get<ApiResponse<EmpresaResumen[]>>('/auth/empresas'),

  guardarPin: (password: string, pin: string, pin_confirmation: string) =>
    client.post<ApiResponse<Usuario>>('/auth/pin', { password, pin, pin_confirmation }),
}
