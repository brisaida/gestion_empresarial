import { useState } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import type { EmpresaResumen } from '@/types'

/**
 * Nombre de la empresa activa en la barra superior.
 * Si el usuario tiene acceso a más de una, se vuelve un selector para cambiar de empresa.
 */
export default function EmpresaSelector() {
  const { state, setEmpresa } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)

  const activa   = state.empresaActiva
  const empresas = state.empresas ?? []
  if (!activa) return null

  const nombre = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--cp)] shrink-0" />
      <span className="text-sm font-semibold text-[var(--cs)] truncate max-w-[40vw] sm:max-w-64">{activa.nombre}</span>
    </>
  )

  // Una sola empresa (o super admin en soporte): solo el nombre
  if (empresas.length < 2 || !empresas.some(e => e.id === activa.id)) {
    return <div className="flex items-center gap-2 min-w-0">{nombre}</div>
  }

  const cambiar = (e: EmpresaResumen) => {
    setAbierto(false)
    if (e.id === activa.id) return
    qc.clear()                 // nada de datos de la empresa anterior en pantalla
    setEmpresa(e)
    navigate('/dashboard')
  }

  return (
    <div className="relative min-w-0">
      <button onClick={() => setAbierto(v => !v)} title="Cambiar de empresa"
        className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-[#F4F7FA] border border-transparent hover:border-gray-200 transition-colors min-w-0">
        {nombre}
        <ChevronDown size={14} className={`text-[#5F6B7A] shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-100 rounded-xl shadow-xl shadow-black/10 z-20 py-1 overflow-hidden">
            <p className="px-4 pt-2 pb-1.5 text-[10px] font-bold text-[#5F6B7A] uppercase tracking-wider">Cambiar de empresa</p>
            <div className="max-h-80 overflow-y-auto">
              {empresas.map(e => (
                <button key={e.id} onClick={() => cambiar(e)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${e.id === activa.id ? 'bg-[var(--cp)]/5' : 'hover:bg-gray-50'}`}>
                  <div className="w-8 h-8 rounded-lg bg-[#F4F7FA] border border-gray-100 flex items-center justify-center shrink-0">
                    <Building2 size={15} className="text-[#5F6B7A]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${e.id === activa.id ? 'font-bold text-[var(--cp)]' : 'font-semibold text-[var(--cs)]'}`}>{e.nombre}</p>
                    {e.rol_nombre && <p className="text-xs text-[#5F6B7A] truncate">{e.rol_nombre}</p>}
                  </div>
                  {e.id === activa.id && <Check size={15} className="text-[var(--cp)] shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
