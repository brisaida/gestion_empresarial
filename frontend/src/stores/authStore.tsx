import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { AuthState, EmpresaResumen, Usuario } from '@/types'

type Action =
  | { type: 'LOGIN'; token: string; usuario: Usuario; empresas: EmpresaResumen[] }
  | { type: 'SET_EMPRESA'; empresa: EmpresaResumen }
  | { type: 'SALIR_EMPRESA' }
  | { type: 'SET_EMPRESAS'; empresas: EmpresaResumen[] }
  | { type: 'SET_USUARIO'; usuario: Usuario }
  | { type: 'LOGOUT' }

const STORAGE_KEY = 'auth'
// Última empresa elegida por cada usuario: al volver a iniciar sesión entra a esa
const ultimaKey = (usuarioId: number) => `ultima-empresa-${usuarioId}`
function leerUltima(usuarioId: number): number | null {
  try { return Number(localStorage.getItem(ultimaKey(usuarioId))) || null } catch { return null }
}

function getInitialState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { token: null, usuario: null, empresas: [], empresaActiva: null }
}

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'LOGIN': {
      // El super admin entra al panel de administración, no a una empresa
      const ultima = leerUltima(action.usuario.id)
      const empresaActiva = action.usuario.es_super_admin
        ? null
        : (action.empresas.find(e => e.id === ultima) ?? action.empresas[0] ?? null)
      return { token: action.token, usuario: action.usuario, empresas: action.empresas, empresaActiva }
    }
    case 'SET_EMPRESA':
      return { ...state, empresaActiva: action.empresa }
    case 'SALIR_EMPRESA':
      return { ...state, empresaActiva: null }
    case 'SET_EMPRESAS': {
      // Refresco desde el servidor: mismos datos de la empresa activa con sus permisos actuales
      const actual = state.empresaActiva
      const enLista = actual ? action.empresas.find(e => e.id === actual.id) : undefined
      const soporte = !!state.usuario?.es_super_admin && !!actual && !enLista   // super admin dentro de otra empresa
      const empresaActiva = soporte ? actual : (enLista ?? (state.usuario?.es_super_admin ? null : action.empresas[0] ?? null))
      return { ...state, empresas: action.empresas, empresaActiva }
    }
    case 'SET_USUARIO':
      return { ...state, usuario: action.usuario }
    case 'LOGOUT':
      return { token: null, usuario: null, empresas: [], empresaActiva: null }
  }
}

interface AuthContextValue {
  state: AuthState
  login: (token: string, usuario: Usuario, empresas: EmpresaResumen[]) => void
  setEmpresa: (empresa: EmpresaResumen) => void
  setEmpresas: (empresas: EmpresaResumen[]) => void
  salirEmpresa: () => void
  setUsuario: (usuario: Usuario) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  useEffect(() => {
    if (state.token) {
      localStorage.setItem('token', state.token)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [state])

  const login = (token: string, usuario: Usuario, empresas: EmpresaResumen[]) =>
    dispatch({ type: 'LOGIN', token, usuario, empresas })

  const setEmpresa = (empresa: EmpresaResumen) => {
    if (state.usuario && !state.usuario.es_super_admin) {
      try { localStorage.setItem(ultimaKey(state.usuario.id), String(empresa.id)) } catch { /* opcional */ }
    }
    dispatch({ type: 'SET_EMPRESA', empresa })
  }

  const setEmpresas = (empresas: EmpresaResumen[]) => dispatch({ type: 'SET_EMPRESAS', empresas })

  const salirEmpresa = () => dispatch({ type: 'SALIR_EMPRESA' })

  const setUsuario = (usuario: Usuario) =>
    dispatch({ type: 'SET_USUARIO', usuario })

  const logout = () => dispatch({ type: 'LOGOUT' })

  return <AuthContext value={{ state, login, setEmpresa, setEmpresas, salirEmpresa, setUsuario, logout }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
