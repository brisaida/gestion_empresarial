import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus, Pencil, ListOrdered, ArrowLeftRight, PiggyBank, Settings2, Ban, Loader2, CheckSquare, Square, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { bancosApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate, getAxiosError, todayISO, cn } from '@/lib/utils'
import type { CategoriaBanco, CuentaBancaria, Moneda } from '@/types'

const ORIGEN: Record<string, string> = {
  venta: 'Venta', abono: 'Abono de cliente', compra: 'Compra', pago_proveedor: 'Pago a proveedor', pago_tarjeta: 'Pago de tarjeta',
  devolucion_venta: 'Devolución a cliente', devolucion_compra: 'Reembolso de proveedor', comision_pos: 'Comisión POS',
  deposito_caja: 'Depósito de caja', transferencia: 'Transferencia', manual: 'Manual',
}

const fmt = (v: number, moneda: Moneda = 'HNL') =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(v)

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[var(--cs)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

type Accion = { tipo: 'editar'; cuenta: CuentaBancaria | null } | { tipo: 'movs' | 'manual' | 'deposito'; cuenta: CuentaBancaria } | { tipo: 'transferencia' | 'config' }

export default function BancosPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const [todas, setTodas]   = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)
  const cerrar = () => setAccion(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cuentas-banco', 'pantalla', empresaId, todas],
    queryFn:  () => bancosApi.cuentas(empresaId, todas).then(r => r.data.data),
    enabled:  empresaId > 0,
  })
  const cuentas = data?.cuentas ?? []

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--cs)]">Bancos</h1>
          <p className="text-sm text-[#5F6B7A]">Cuentas de la empresa y sus movimientos. Lo que se cobra o paga por banco en ventas, compras y pagos se registra solo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer select-none mr-1">
            <input type="checkbox" checked={todas} onChange={e => setTodas(e.target.checked)} className="rounded accent-[var(--cp)]" />
            Ver desactivadas
          </label>
          <Button variant="secondary" icon={<Settings2 size={15} />} onClick={() => setAccion({ tipo: 'config' })}>Configuración</Button>
          <Button variant="secondary" icon={<ArrowLeftRight size={15} />} disabled={cuentas.filter(c => c.activo).length < 2} onClick={() => setAccion({ tipo: 'transferencia' })}>Transferir</Button>
          <Button icon={<Plus size={15} />} onClick={() => setAccion({ tipo: 'editar', cuenta: null })}>Nueva cuenta</Button>
        </div>
      </div>

      {Object.keys(data?.totales ?? {}).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(data!.totales).map(([m, v]) => (
            <div key={m} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-[11px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Total en {m === 'HNL' ? 'lempiras' : 'dólares'}</p>
              <p className="text-xl font-bold text-[var(--cs)]">{fmt(v ?? 0, m as Moneda)}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-14"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
      ) : cuentas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-14 text-center">
          <Landmark size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-[#5F6B7A]">No hay cuentas bancarias registradas.</p>
          <Button className="mt-4" icon={<Plus size={15} />} onClick={() => setAccion({ tipo: 'editar', cuenta: null })}>Agregar la primera</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cuentas.map(c => (
            <div key={c.id} className={cn('bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4', !c.activo && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--cs) 0%, var(--cp) 100%)' }}>
                    <Landmark size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--cs)] truncate">{c.banco} · {c.nombre}</p>
                    <p className="text-sm text-[#5F6B7A]"><span className="font-mono">•••• {c.ultimos4}</span> · {c.tipo === 'ahorro' ? 'Ahorro' : 'Cheques'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={c.moneda === 'USD' ? 'indigo' : 'gray'}>{c.moneda}</Badge>
                  {!c.activo && <Badge variant="gray">Desactivada</Badge>}
                  <button onClick={() => setAccion({ tipo: 'editar', cuenta: c })} title="Editar" className="p-1.5 rounded text-gray-400 hover:text-[var(--cp)] hover:bg-gray-100"><Pencil size={14} /></button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#5F6B7A] uppercase tracking-wide">Saldo según el sistema</p>
                <p className={cn('text-2xl font-bold', c.saldo < 0 ? 'text-red-600' : 'text-[var(--cs)]')}>{fmt(c.saldo, c.moneda)}</p>
                {c.comision_pos_pct ? <p className="text-xs text-[#5F6B7A]">Comisión POS {c.comision_pos_pct}%</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-auto">
                <Button size="sm" variant="secondary" icon={<ListOrdered size={14} />} onClick={() => setAccion({ tipo: 'movs', cuenta: c })}>Movimientos</Button>
                <Button size="sm" icon={<Plus size={14} />} disabled={!c.activo} onClick={() => setAccion({ tipo: 'manual', cuenta: c })}>Movimiento</Button>
                {c.moneda === 'HNL' && (
                  <Button size="sm" variant="secondary" icon={<PiggyBank size={14} />} disabled={!c.activo} onClick={() => setAccion({ tipo: 'deposito', cuenta: c })}>Depósito de caja</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={accion?.tipo === 'editar'} onClose={cerrar} title={accion?.tipo === 'editar' && accion.cuenta ? 'Editar cuenta' : 'Nueva cuenta bancaria'} size="md">
        {accion?.tipo === 'editar' && <FormCuenta key={accion.cuenta?.id ?? 'n'} cuenta={accion.cuenta} empresaId={empresaId} onClose={cerrar} />}
      </Modal>
      <Modal open={accion?.tipo === 'manual'} onClose={cerrar} title="Movimiento manual" size="md">
        {accion?.tipo === 'manual' && <FormManual key={accion.cuenta.id} cuenta={accion.cuenta} empresaId={empresaId} onClose={cerrar} />}
      </Modal>
      <Modal open={accion?.tipo === 'deposito'} onClose={cerrar} title="Depósito de efectivo de caja" size="sm">
        {accion?.tipo === 'deposito' && <FormDeposito key={accion.cuenta.id} cuenta={accion.cuenta} onClose={cerrar} />}
      </Modal>
      <Modal open={accion?.tipo === 'transferencia'} onClose={cerrar} title="Transferencia entre cuentas" size="md">
        {accion?.tipo === 'transferencia' && <FormTransferencia cuentas={cuentas.filter(c => c.activo)} onClose={cerrar} />}
      </Modal>
      <Modal open={accion?.tipo === 'config'} onClose={cerrar} title="Configuración de bancos" size="lg">
        {accion?.tipo === 'config' && <Configuracion empresaId={empresaId} cuentas={cuentas.filter(c => c.activo && c.moneda === 'HNL')} onClose={cerrar} />}
      </Modal>
      <Modal open={accion?.tipo === 'movs'} onClose={cerrar} title={accion?.tipo === 'movs' ? `Movimientos · ${accion.cuenta.etiqueta}` : ''} size="xl">
        {accion?.tipo === 'movs' && <Movimientos key={accion.cuenta.id} cuenta={accion.cuenta} />}
      </Modal>
    </div>
  )
}

function useRefrescar() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
    qc.invalidateQueries({ queryKey: ['banco-movs'] })
    qc.invalidateQueries({ queryKey: ['caja-actual'] })
  }
}

function Pie({ error, cargando, onClose, texto = 'Guardar' }: { error: string; cargando: boolean; onClose: () => void; texto?: string }) {
  return (
    <>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={cargando}>{texto}</Button>
      </div>
    </>
  )
}

function FormCuenta({ cuenta, empresaId, onClose }: { cuenta: CuentaBancaria | null; empresaId: number; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [f, setF] = useState({
    banco: cuenta?.banco ?? '', nombre: cuenta?.nombre ?? '', tipo: cuenta?.tipo ?? 'corriente', ultimos4: cuenta?.ultimos4 ?? '',
    moneda: cuenta?.moneda ?? 'HNL', saldo_inicial: cuenta ? String(cuenta.saldo_inicial) : '', fecha_saldo_inicial: cuenta?.fecha_saldo_inicial ?? todayISO(),
    comision_pos_pct: cuenta?.comision_pos_pct != null ? String(cuenta.comision_pos_pct) : '', activo: cuenta?.activo ?? true,
  })
  const [error, setError] = useState('')
  const guardar = useMutation({
    mutationFn: () => {
      const d = {
        ...f, empresa_id: empresaId, banco: f.banco.trim(), nombre: f.nombre.trim(),
        saldo_inicial: f.saldo_inicial ? Number(f.saldo_inicial) : 0, comision_pos_pct: f.comision_pos_pct ? Number(f.comision_pos_pct) : null,
      }
      return cuenta ? bancosApi.actualizar(cuenta.id, d) : bancosApi.crear(d)
    },
    onSuccess: () => { refrescar(); toast.success(cuenta ? 'Cuenta actualizada.' : 'Cuenta agregada.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Banco *" value={f.banco} placeholder="BAC, Ficohsa, Atlántida…" onChange={e => setF({ ...f, banco: e.target.value })} />
        <Input label="Nombre de la cuenta *" value={f.nombre} placeholder="Operativa, Planilla…" onChange={e => setF({ ...f, nombre: e.target.value })} />
        <Input label="Últimos 4 dígitos *" value={f.ultimos4} maxLength={4} inputMode="numeric" onChange={e => setF({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as 'corriente' | 'ahorro' })} className={inputCls}>
            <option value="corriente">Cheques / corriente</option>
            <option value="ahorro">Ahorro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Moneda</label>
          <select value={f.moneda} onChange={e => setF({ ...f, moneda: e.target.value as Moneda })} className={inputCls}>
            <option value="HNL">Lempiras (HNL)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <Input label="Comisión POS (%)" type="number" step="0.01" min="0" max="20" value={f.comision_pos_pct} placeholder="Opcional"
          onChange={e => setF({ ...f, comision_pos_pct: e.target.value })} />
        <Input label={`Saldo inicial (${f.moneda})`} type="number" step="0.01" value={f.saldo_inicial} placeholder="0.00" onChange={e => setF({ ...f, saldo_inicial: e.target.value })} />
        <Input label="Saldo a la fecha" type="date" value={f.fecha_saldo_inicial} onChange={e => setF({ ...f, fecha_saldo_inicial: e.target.value })} />
      </div>
      <p className="text-[11px] text-[#5F6B7A]">
        El saldo inicial es lo que tenía la cuenta al empezar a usarla en el sistema. La comisión POS es el % que cobra el banco por ventas con tarjeta que caen en esta cuenta; déjala vacía si no aplica.
        {f.moneda === 'USD' && ' Las cuentas en dólares no se enlazan a ventas ni compras (que son en lempiras): se mueven con transferencias y movimientos manuales.'}
      </p>
      <label className="inline-flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
        <input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} className="rounded accent-[var(--cp)]" /> Activa
      </label>
      <Pie error={error} cargando={guardar.isPending} onClose={onClose} />
    </form>
  )
}

function FormManual({ cuenta, empresaId, onClose }: { cuenta: CuentaBancaria; empresaId: number; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [tipo, setTipo]   = useState<'entrada' | 'salida'>('salida')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [desc, setDesc]   = useState('')
  const [cat, setCat]     = useState('')
  const [ref, setRef]     = useState('')
  const [error, setError] = useState('')
  const { data: config } = useQuery({ queryKey: ['banco-config', empresaId], queryFn: () => bancosApi.configuracion(empresaId).then(r => r.data.data) })
  const categorias = (config?.categorias ?? []).filter(c => c.activo && (c.tipo === 'ambos' || c.tipo === tipo))

  const guardar = useMutation({
    mutationFn: () => bancosApi.movimiento(cuenta.id, { tipo, monto: Number(monto), fecha, descripcion: desc.trim(), categoria_banco_id: cat ? Number(cat) : null, referencia: ref.trim() || null }),
    onSuccess: () => { refrescar(); toast.success('Movimiento registrado.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4F7FA] border border-gray-200 rounded-lg">
        {(['entrada', 'salida'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTipo(t); setCat('') }}
            className={cn('py-1.5 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5', tipo === t ? 'bg-white shadow-sm ' + (t === 'entrada' ? 'text-emerald-600' : 'text-red-600') : 'text-[#5F6B7A]')}>
            {t === 'entrada' ? <><ArrowDownLeft size={14} /> Entrada</> : <><ArrowUpRight size={14} /> Salida</>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label={`Monto (${cuenta.moneda}) *`} type="number" step="0.01" min="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
        <div>
          <label className={labelCls}>Categoría</label>
          <select value={cat} onChange={e => setCat(e.target.value)} className={inputCls}>
            <option value="">— Sin categoría —</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <Input label="N° de referencia" value={ref} onChange={e => setRef(e.target.value)} />
        <div className="col-span-2"><Input label="Descripción *" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Planilla 2da quincena, alquiler de local…" /></div>
      </div>
      <Pie error={error} cargando={guardar.isPending} onClose={onClose} texto="Registrar" />
    </form>
  )
}

function FormDeposito({ cuenta, onClose }: { cuenta: CuentaBancaria; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [ref, setRef]     = useState('')
  const [error, setError] = useState('')
  const guardar = useMutation({
    mutationFn: () => bancosApi.depositoCaja(cuenta.id, { monto: Number(monto), fecha, referencia: ref.trim() || null }),
    onSuccess: () => { refrescar(); toast.success('Depósito registrado.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <p className="text-sm text-[#5F6B7A]">Efectivo que sale de la caja y se deposita en <strong>{cuenta.etiqueta}</strong>. Se resta del efectivo esperado en el cierre de caja.</p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Monto (L) *" type="number" step="0.01" min="0.01" value={monto} autoFocus onChange={e => setMonto(e.target.value)} />
        <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />
        <div className="col-span-2"><Input label="N° de boleta" value={ref} onChange={e => setRef(e.target.value)} /></div>
      </div>
      <Pie error={error} cargando={guardar.isPending} onClose={onClose} texto="Registrar depósito" />
    </form>
  )
}

function FormTransferencia({ cuentas, onClose }: { cuentas: CuentaBancaria[]; onClose: () => void }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const [origen, setOrigen]   = useState(cuentas[0] ? String(cuentas[0].id) : '')
  const [destino, setDestino] = useState(cuentas[1] ? String(cuentas[1].id) : '')
  const [monto, setMonto]     = useState('')
  const [llega, setLlega]     = useState('')
  const [fecha, setFecha]     = useState(todayISO())
  const [ref, setRef]         = useState('')
  const [error, setError]     = useState('')
  const co = cuentas.find(c => String(c.id) === origen)
  const cd = cuentas.find(c => String(c.id) === destino)
  const distintas = !!co && !!cd && co.moneda !== cd.moneda
  const tasa = distintas && Number(monto) > 0 && Number(llega) > 0
    ? (co!.moneda === 'HNL' ? Number(monto) / Number(llega) : Number(llega) / Number(monto)) : null

  const guardar = useMutation({
    mutationFn: () => bancosApi.transferir({
      cuenta_origen_id: Number(origen), cuenta_destino_id: Number(destino), monto: Number(monto),
      monto_destino: distintas ? Number(llega) : null, fecha, referencia: ref.trim() || null,
    }),
    onSuccess: () => { refrescar(); toast.success('Transferencia registrada.'); onClose() },
    onError: err => setError(getAxiosError(err)),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Desde</label>
          <select value={origen} onChange={e => setOrigen(e.target.value)} className={inputCls}>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hacia</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={inputCls}>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
        </div>
        <Input label={`Monto que sale (${co?.moneda ?? ''}) *`} type="number" step="0.01" min="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
        {distintas
          ? <Input label={`Monto que llega (${cd?.moneda}) *`} type="number" step="0.01" min="0.01" value={llega} onChange={e => setLlega(e.target.value)} />
          : <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />}
        {distintas && <Input label="Fecha" type="date" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} />}
        <Input label="N° de referencia" value={ref} onChange={e => setRef(e.target.value)} />
      </div>
      {tasa && <p className="text-xs text-[#5F6B7A]">Tipo de cambio: L {tasa.toFixed(4)} por dólar.</p>}
      <Pie error={error} cargando={guardar.isPending} onClose={onClose} texto="Transferir" />
    </form>
  )
}

function Configuracion({ empresaId, cuentas, onClose }: { empresaId: number; cuentas: CuentaBancaria[]; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({ queryKey: ['banco-config', empresaId], queryFn: () => bancosApi.configuracion(empresaId).then(r => r.data.data) })
  const [def, setDef] = useState<Record<string, string> | null>(null)
  const valores = def ?? {
    cuenta_tarjeta_id: data?.defectos.cuenta_tarjeta_id ? String(data.defectos.cuenta_tarjeta_id) : '',
    cuenta_transferencia_id: data?.defectos.cuenta_transferencia_id ? String(data.defectos.cuenta_transferencia_id) : '',
    cuenta_pagos_id: data?.defectos.cuenta_pagos_id ? String(data.defectos.cuenta_pagos_id) : '',
  }
  const [nueva, setNueva] = useState({ nombre: '', tipo: 'salida' as CategoriaBanco['tipo'] })
  const [error, setError] = useState('')

  const guardarDef = useMutation({
    mutationFn: () => bancosApi.guardarDefectos({
      empresa_id: empresaId,
      ...Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v ? Number(v) : null])),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banco-config'] })
      qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
      toast.success('Cuentas por defecto guardadas.')
      onClose()
    },
    onError: err => setError(getAxiosError(err)),
  })
  const guardarCat = useMutation({
    mutationFn: (c: { id?: number; nombre: string; tipo: string; activo: boolean }) => bancosApi.guardarCategoria({ empresa_id: empresaId, ...c }, c.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banco-config'] }); setNueva({ nombre: '', tipo: 'salida' }) },
    onError: err => setError(getAxiosError(err)),
  })

  const usos: [keyof typeof valores, string, string][] = [
    ['cuenta_tarjeta_id', 'Ventas y abonos con tarjeta (POS)', 'Donde el banco deposita lo cobrado con tarjeta.'],
    ['cuenta_transferencia_id', 'Ventas y abonos por transferencia', 'Donde los clientes transfieren.'],
    ['cuenta_pagos_id', 'Pagos (compras, proveedores, tarjetas)', 'De donde salen los pagos por débito, transferencia o cheque.'],
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-[var(--cs)] mb-1">Cuentas por defecto</p>
        <p className="text-xs text-[#5F6B7A] mb-3">Se proponen solas al cobrar o pagar por banco; siempre se pueden cambiar. Sin cuenta por defecto, el pago no se registra en bancos salvo que se elija una.</p>
        <div className="space-y-3">
          {usos.map(([k, l, d]) => (
            <div key={k} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div><p className="text-sm font-medium text-[var(--cs)]">{l}</p><p className="text-[11px] text-[#5F6B7A]">{d}</p></div>
              <select value={valores[k]} onChange={e => setDef({ ...valores, [k]: e.target.value })} className={inputCls}>
                <option value="">— Ninguna —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3"><Button loading={guardarDef.isPending} onClick={() => guardarDef.mutate()}>Guardar cuentas por defecto</Button></div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm font-bold text-[var(--cs)] mb-1">Categorías de movimientos manuales</p>
        <p className="text-xs text-[#5F6B7A] mb-3">Para clasificar planilla, alquiler, servicios, etc. Cada empresa define las suyas.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(data?.categorias ?? []).map(c => (
            <button key={c.id} type="button" title={c.activo ? 'Desactivar' : 'Activar'}
              onClick={() => guardarCat.mutate({ id: c.id, nombre: c.nombre, tipo: c.tipo, activo: !c.activo })}
              className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', c.activo ? 'border-gray-200 text-[var(--cs)]' : 'border-dashed border-gray-200 text-gray-400 line-through')}>
              {c.nombre} <span className="font-normal text-[#5F6B7A]">· {c.tipo === 'ambos' ? 'entrada/salida' : c.tipo}</span>
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (nueva.nombre.trim()) guardarCat.mutate({ nombre: nueva.nombre.trim(), tipo: nueva.tipo, activo: true }) }} className="flex flex-wrap gap-2">
          <input value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Nueva categoría" className={cn(inputCls, 'flex-1 min-w-[160px]')} />
          <select value={nueva.tipo} onChange={e => setNueva({ ...nueva, tipo: e.target.value as CategoriaBanco['tipo'] })} className={cn(inputCls, 'w-auto')}>
            <option value="salida">Salida</option><option value="entrada">Entrada</option><option value="ambos">Ambos</option>
          </select>
          <Button type="submit" variant="secondary" icon={<Plus size={14} />} loading={guardarCat.isPending}>Agregar</Button>
        </form>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  )
}

function Movimientos({ cuenta }: { cuenta: CuentaBancaria }) {
  const refrescar = useRefrescar()
  const toast = useToast()
  const inicioMes = todayISO().slice(0, 8) + '01'
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState('')
  const [filtro, setFiltro] = useState<'' | 'pendientes'>('')

  const { data, isLoading } = useQuery({
    queryKey: ['banco-movs', cuenta.id, desde, hasta, filtro],
    queryFn:  () => bancosApi.movimientos(cuenta.id, { fecha_desde: desde || undefined, fecha_hasta: hasta || undefined, conciliado: filtro === 'pendientes' ? 0 : undefined }).then(r => r.data.data),
  })
  const conciliar = useMutation({
    mutationFn: ({ id, ok }: { id: number; ok: boolean }) => bancosApi.conciliar(id, ok),
    onSuccess: () => refrescar(),
    onError: err => toast.error(getAxiosError(err)),
  })
  const anular = useMutation({
    mutationFn: (id: number) => bancosApi.anular(id),
    onSuccess: () => { refrescar(); toast.success('Movimiento anulado.') },
    onError: err => toast.error(getAxiosError(err)),
  })

  const movs = data?.movimientos ?? []
  const entradas = movs.filter(m => !m.anulado && m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0)
  const salidas  = movs.filter(m => !m.anulado && m.tipo === 'salida').reduce((s, m) => s + m.monto, 0)
  const m$ = (v: number) => fmt(v, cuenta.moneda)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[#5F6B7A]">Del</span>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5" />
        <span className="text-[#5F6B7A]">al</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5" />
        <button onClick={() => { setDesde(''); setHasta('') }} className="text-xs font-semibold text-[var(--cp)] hover:underline">Todo</button>
        <div className="flex-1" />
        <select value={filtro} onChange={e => setFiltro(e.target.value as '' | 'pendientes')} className="rounded-lg border border-gray-200 px-2 py-1.5">
          <option value="">Todos</option>
          <option value="pendientes">Sin conciliar</option>
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
        {[['Saldo anterior', data?.saldo_inicial ?? 0, ''], ['Entradas', entradas, 'text-emerald-600'], ['Salidas', salidas, 'text-red-600'],
          ['Saldo actual', cuenta.saldo, ''], ['Sin conciliar', data?.sin_conciliar.neto ?? 0, 'text-amber-700']].map(([l, v, c]) => (
          <div key={l as string} className="px-3 py-2 rounded-lg bg-[#F4F7FA]">
            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide">{l}{l === 'Sin conciliar' && data ? ` (${data.sin_conciliar.cantidad})` : ''}</p>
            <p className={cn('font-bold text-[var(--cs)]', c as string)}>{m$(v as number)}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--cp)]" /></div>
      ) : movs.length === 0 ? (
        <p className="text-sm text-center text-[#5F6B7A] py-8">Sin movimientos en este período.</p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F7FA] text-[10px] uppercase tracking-wider text-[#5F6B7A] sticky top-0">
              <tr>
                <th className="px-2 py-2" title="Conciliado con el estado de cuenta">✓</th>
                <th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Detalle</th>
                <th className="px-3 py-2 text-right">Entrada</th><th className="px-3 py-2 text-right">Salida</th><th className="px-3 py-2 text-right">Saldo</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movs.map(m => (
                <tr key={m.id} className={m.anulado ? 'opacity-50' : ''}>
                  <td className="px-2 py-2 text-center">
                    {!m.anulado && (
                      <button onClick={() => conciliar.mutate({ id: m.id, ok: !m.conciliado })} title={m.conciliado ? 'Conciliado' : 'Marcar como conciliado'}
                        className={m.conciliado ? 'text-emerald-600' : 'text-gray-300 hover:text-[var(--cp)]'}>
                        {m.conciliado ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#5F6B7A] whitespace-nowrap">{formatDate(m.fecha)}</td>
                  <td className="px-3 py-2">
                    <p className={cn('text-[var(--cs)]', m.anulado && 'line-through')}>{m.descripcion}</p>
                    <p className="text-[10px] text-[#5F6B7A]">
                      {ORIGEN[m.origen] ?? m.origen}{m.categoria ? ` · ${m.categoria}` : ''}{m.referencia ? ` · ref. ${m.referencia}` : ''}{m.usuario ? ` · ${m.usuario}` : ''}{m.anulado ? ' · ANULADO' : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{m.tipo === 'entrada' ? m$(m.monto) : ''}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">{m.tipo === 'salida' ? m$(m.monto) : ''}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--cs)]">{m$(m.saldo)}</td>
                  <td className="px-2 py-2 text-right">
                    {!m.anulado && ['manual', 'deposito_caja', 'transferencia'].includes(m.origen) && (
                      <button onClick={() => { if (confirm(m.origen === 'transferencia' ? '¿Anular la transferencia? Se anula en las dos cuentas.' : '¿Anular este movimiento?')) anular.mutate(m.id) }}
                        title="Anular" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Ban size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#5F6B7A]">Marca ✓ los movimientos que ya aparecen en el estado de cuenta del banco. Los que vienen de ventas, compras o pagos se anulan desde ese documento.</p>
    </div>
  )
}
