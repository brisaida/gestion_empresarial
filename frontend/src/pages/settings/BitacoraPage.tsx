import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, History, X } from 'lucide-react'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import SearchBar from '@/components/ui/SearchBar'
import { useAuth } from '@/stores/authStore'
import { bitacoraApi } from '@/api/recursos'
import { saEmpresasApi } from '@/api/superAdmin'
import type { Bitacora, CambioBitacora } from '@/types'

/**
 * Bitácora de auditoría: quién hizo qué y cuándo.
 * - Normal (Configuración): solo la empresa activa + los inicios de sesión de sus usuarios.
 * - global (super admin): todas las empresas, roles y usuarios.
 */

const MODULOS: Record<string, string> = {
  ventas: 'Ventas', compras: 'Compras', cotizaciones: 'Cotizaciones', inventario: 'Inventario', traslados: 'Traslados',
  catalogos: 'Catálogos', finanzas: 'Finanzas', configuracion: 'Configuración', usuarios: 'Usuarios y roles', sesion: 'Inicios de sesión',
}

type Variante = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'indigo'
const ACCIONES: Record<string, [string, Variante]> = {
  crear: ['Creó', 'green'], editar: ['Editó', 'blue'], eliminar: ['Eliminó', 'red'], cancelar: ['Canceló', 'red'],
  anular: ['Anuló', 'red'], rechazar: ['Rechazó', 'yellow'], cambiar_estado: ['Cambió estado', 'indigo'],
  activar: ['Activó', 'green'], desactivar: ['Desactivó', 'yellow'], importar: ['Importó', 'indigo'], unir: ['Unió', 'indigo'],
  login: ['Inició sesión', 'gray'], logout: ['Cerró sesión', 'gray'], login_fallido: ['Intento fallido', 'red'],
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') return v.toLocaleString('es-HN', { maximumFractionDigits: 4 })
  if (Array.isArray(v)) return v.length ? v.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function BitacoraPage({ global = false }: { global?: boolean }) {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0

  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [desde, setDesde]         = useState('')
  const [hasta, setHasta]         = useState('')
  const [modulo, setModulo]       = useState('')
  const [accion, setAccion]       = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [entidad, setEntidad]     = useState<{ tipo: string; id: number; nombre: string } | null>(null)
  const [abierta, setAbierta]     = useState<number | null>(null)

  const params = {
    empresa_id: global ? (empresaFiltro || undefined) : empresaId,
    page, search: search || undefined, fecha_desde: desde || undefined, fecha_hasta: hasta || undefined,
    modulo: modulo || undefined, accion: accion || undefined, usuario_id: usuarioId || undefined,
    entidad_tipo: entidad?.tipo, entidad_id: entidad?.id,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['bitacora', global, params],
    queryFn:  () => bitacoraApi.list(params, global).then(r => r.data),
    enabled:  global || empresaId > 0,
    placeholderData: keepPreviousData,
  })

  const { data: opciones } = useQuery({
    queryKey: ['bitacora-opciones', global, empresaId],
    queryFn:  () => bitacoraApi.opciones(global ? undefined : empresaId, global).then(r => r.data.data),
    enabled:  global || empresaId > 0,
    staleTime: 5 * 60_000,
  })

  const { data: empresas } = useQuery({
    queryKey: ['sa-empresas-bitacora'],
    queryFn:  () => saEmpresasApi.list({ per_page: 200 }).then(r => r.data.data),
    enabled:  global,
    staleTime: 5 * 60_000,
  })

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); setAbierta(null) }

  const columns: Column<Bitacora>[] = [
    {
      key: 'exp', header: '', width: '36px',
      cell: b => (b.cambios.length > 0 || b.entidad_tipo) ? (
        <button onClick={() => setAbierta(abierta === b.id ? null : b.id)} title="Ver detalle"
          className="p-1 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100">
          {abierta === b.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : null,
    },
    { key: 'fecha', header: 'Fecha', width: '150px', cell: b => <span className="text-xs text-[#5F6B7A] whitespace-nowrap">{fechaHora(b.fecha)}</span> },
    { key: 'usuario', header: 'Usuario', cell: b => <span className="text-sm font-medium text-[var(--cs)] whitespace-nowrap">{b.usuario?.nombre ?? '—'}</span> },
    ...(global ? [{ key: 'empresa', header: 'Empresa', cell: (b: Bitacora) => <span className="text-xs text-[#5F6B7A]">{b.empresa?.nombre ?? 'General'}</span> }] : []),
    {
      key: 'accion', header: 'Acción',
      cell: b => { const [t, v] = ACCIONES[b.accion] ?? [b.accion, 'gray' as Variante]; return <Badge variant={v}>{t}</Badge> },
    },
    { key: 'modulo', header: 'Módulo', cell: b => <span className="text-xs text-[#5F6B7A] whitespace-nowrap">{MODULOS[b.modulo] ?? b.modulo}</span> },
    { key: 'desc', header: 'Detalle', cell: b => <span className="text-sm text-[var(--cs)]">{b.descripcion}</span> },
  ]

  const fila = data?.data.find(b => b.id === abierta)
  const filtrosActivos = !!(search || desde || hasta || modulo || accion || usuarioId || entidad || empresaFiltro)
  const inputCls = 'rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-[var(--cs)] bg-white'

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Bitácora</h1>
        <p className="text-sm text-[#5F6B7A]">
          {global
            ? 'Todo lo que pasa en el sistema: empresas, usuarios, roles e inicios de sesión.'
            : 'Quién creó, editó, canceló o eliminó cada cosa, y cuándo. También los inicios de sesión de los usuarios de la empresa.'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
          {global && (
            <select value={empresaFiltro} onChange={e => reset(setEmpresaFiltro)(e.target.value)} className={inputCls}>
              <option value="">Todas las empresas</option>
              <option value="global">General (roles, usuarios)</option>
              {empresas?.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          )}
          <select value={usuarioId} onChange={e => reset(setUsuarioId)(e.target.value)} className={inputCls}>
            <option value="">Todos los usuarios</option>
            {opciones?.usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <select value={modulo} onChange={e => reset(setModulo)(e.target.value)} className={inputCls}>
            <option value="">Todos los módulos</option>
            {Object.entries(MODULOS).filter(([k]) => global || k !== 'usuarios').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={accion} onChange={e => reset(setAccion)(e.target.value)} className={inputCls}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACCIONES).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <input type="date" value={desde} onChange={e => reset(setDesde)(e.target.value)} className={inputCls} />
          <span className="text-[#5F6B7A] text-sm">a</span>
          <input type="date" value={hasta} onChange={e => reset(setHasta)(e.target.value)} className={inputCls} />
          <SearchBar value={search} onChange={reset(setSearch)} placeholder="Código, factura, nombre..." className="w-56" />
          {filtrosActivos && (
            <button onClick={() => { setSearch(''); setDesde(''); setHasta(''); setModulo(''); setAccion(''); setUsuarioId(''); setEmpresaFiltro(''); setEntidad(null); setPage(1) }}
              className="text-xs font-semibold text-[var(--cp)] hover:underline ml-1">Quitar filtros</button>
          )}
        </div>

        {entidad && (
          <div className="px-4 py-2 bg-[#F4F7FA] border-b border-gray-100 flex items-center gap-2 text-sm">
            <History size={14} className="text-[var(--cp)]" />
            <span className="text-[#5F6B7A]">Historial de</span>
            <span className="font-semibold text-[var(--cs)]">{entidad.nombre}</span>
            <button onClick={() => reset(setEntidad)(null)} className="p-0.5 rounded text-gray-400 hover:text-red-500" title="Quitar"><X size={14} /></button>
          </div>
        )}

        <Table columns={columns} data={data?.data ?? []} loading={isLoading}
          error={error ? 'No se pudo cargar la bitácora.' : null}
          emptyMessage={filtrosActivos ? 'No hay registros con esos filtros.' : 'Aún no hay registros. A partir de ahora cada cambio queda anotado aquí.'}
          expandedRow={fila ? { id: fila.id, content: <Detalle b={fila} onHistorial={entidad ? undefined : () => {
            setEntidad({ tipo: fila.entidad_tipo!, id: fila.entidad_id!, nombre: fila.descripcion?.split(':')[0] ?? fila.entidad_tipo! })
            setPage(1); setAbierta(null)
          }} /> } : undefined} />
        {data?.meta && <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={p => { setPage(p); setAbierta(null) }} />}
      </div>
    </div>
  )
}

function Detalle({ b, onHistorial }: { b: Bitacora; onHistorial?: () => void }) {
  const soloNuevo = b.cambios.every(c => c.antes === null || c.antes === undefined)
  const soloAntes = b.cambios.every(c => c.despues === null || c.despues === undefined)
  const comparar  = !soloNuevo && !soloAntes

  return (
    <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-3 space-y-3">
      {b.cambios.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#5F6B7A] uppercase tracking-wide">
              <th className="py-1 pr-4 font-semibold w-48">Campo</th>
              {comparar ? <><th className="py-1 pr-4 font-semibold">Antes</th><th className="py-1 font-semibold">Después</th></>
                        : <th className="py-1 font-semibold">{soloAntes ? 'Valor que tenía' : 'Valor'}</th>}
            </tr>
          </thead>
          <tbody>
            {b.cambios.map((c: CambioBitacora) => (
              <tr key={c.campo} className="border-t border-gray-100 align-top">
                <td className="py-1 pr-4 text-[#5F6B7A]">{c.etiqueta}</td>
                {comparar ? (
                  <>
                    <td className="py-1 pr-4 text-red-600 line-through decoration-red-300 break-all">{valor(c.antes)}</td>
                    <td className="py-1 text-emerald-700 font-medium break-all">{valor(c.despues)}</td>
                  </>
                ) : <td className="py-1 text-[var(--cs)] break-all">{valor(soloAntes ? c.antes : c.despues)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between text-[11px] text-[#5F6B7A]">
        <span>{b.ip ? `IP ${b.ip}` : ''}</span>
        {onHistorial && b.entidad_tipo && b.entidad_id && (
          <button onClick={onHistorial} className="inline-flex items-center gap-1 font-semibold text-[var(--cp)] hover:underline">
            <History size={12} /> Ver todo el historial de este registro
          </button>
        )}
      </div>
    </div>
  )
}
