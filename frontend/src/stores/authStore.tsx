import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { AuthState, EmpresaResumen, Usuario } from '@/types'

type Action =
  | { type: 'LOGIN'; token: string; usuario: Usuario; empresas: EmpresaResumen[] }
  | { type: 'SET_EMPRESA'; empresa: EmpresaResumen }
  | { type: 'SALIR_EMPRESA' }
  | { type: 'SET_USUARIO'; usuario: Usuario }
  | { type: 'LOGOUT' }

const STORAGE_KEY = 'auth'

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
      const empresaActiva = action.usuario.es_super_admin ? null : (action.empresas[0] ?? null)
      return { token: action.token, usuario: action.usuario, empresas: action.empresas, empresaActiva }
    }
    case 'SET_EMPRESA':
      return { ...state, empresaActiva: action.empresa }
    case 'SALIR_EMPRESA':
      return { ...state, empresaActiva: null }
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

  const setEmpresa = (empresa: EmpresaResumen) =>
    dispatch({ type: 'SET_EMPRESA', empresa })

  const salirEmpresa = () => dispatch({ type: 'SALIR_EMPRESA' })

  const setUsuario = (usuario: Usuario) =>
    dispatch({ type: 'SET_USUARIO', usuario })

  const logout = () => dispatch({ type: 'LOGOUT' })

  return <AuthContext value={{ state, login, setEmpresa, salirEmpresa, setUsuario, logout }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
