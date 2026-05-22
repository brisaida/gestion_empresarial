import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { AuthState, EmpresaResumen, Usuario } from '@/types'

type Action =
  | { type: 'LOGIN'; token: string; usuario: Usuario; empresas: EmpresaResumen[] }
  | { type: 'SET_EMPRESA'; empresa: EmpresaResumen }
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
      const empresaActiva = action.empresas[0] ?? null
      return { token: action.token, usuario: action.usuario, empresas: action.empresas, empresaActiva }
    }
    case 'SET_EMPRESA':
      return { ...state, empresaActiva: action.empresa }
    case 'LOGOUT':
      return { token: null, usuario: null, empresas: [], empresaActiva: null }
  }
}

interface AuthContextValue {
  state: AuthState
  login: (token: string, usuario: Usuario, empresas: EmpresaResumen[]) => void
  setEmpresa: (empresa: EmpresaResumen) => void
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

  const logout = () => dispatch({ type: 'LOGOUT' })

  return <AuthContext value={{ state, login, setEmpresa, logout }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
