import client from './client'
import type { ApiResponse, AuthState, Usuario } from '@/types'

export const authApi = {
  login: (correo: string, password: string) =>
    client.post<ApiResponse<Omit<AuthState, 'empresaActiva'> & { token: string; usuario: Usuario }>>('/auth/login', { correo, password }),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<ApiResponse<Usuario>>('/auth/me'),
}
