import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ShoppingCart, ClipboardList, Sparkles, Camera, Loader2, X, AlertCircle, CheckCircle2, FileText, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { comprasApi, proveedoresApi, bodegasApi, productosApi } from '@/api/recursos'
import type { FacturaEscaneada } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { formatCurrency, getAxiosError, todayISO } from '@/lib/utils'
import type { Proveedor, Producto } from '@/types'

interface LineaItem {
  producto_id: string
  cantidad: string
  costo_unitario: string
  lote: string
  fecha_vencimiento: string
  hint?: string
  // conversión bulto → unidad
  bulto: boolean
  cant_bultos: string
  unidades_por_bulto: string
  costo_por_bulto: string
}

const emptyLinea = (): LineaItem => ({
  producto_id: '', cantidad: '', costo_unitario: '', lote: '', fecha_vencimiento: '',
  bulto: false, cant_bultos: '', unidades_por_bulto: '', costo_por_bulto: '',
})

const inputCls = 'w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all'

function fileToBase64(file: File): Promise<{ data: string; media_type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, data] = result.split(',')
      const media_type = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      resolve({ data, media_type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Modal: Crear proveedor rápido ────────────────────────────────────────────

interface ProveedorHint {
  nombre:    string
  rtn?:      string | null
  telefono?: string | null
  correo?:   string | null
}

interface CrearProveedorProps {
  open: boolean
  onClose: () => void
  empresaId: number
  hint: ProveedorHint | null
  onCreado: (p: Proveedor) => void
}

function CrearProveedorModal({ open, onClose, empresaId, hint, onCreado }: CrearProveedorProps) {
  const qc = useQueryClient()
  const [nombre,   setNombre]   = useState('')
  const [rtn,      setRtn]      = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo,   setCorreo]   = useState('')
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (open) {
      setNombre(hint?.nombre ?? '')
      setRtn(hint?.rtn ?? '')
      setTelefono(hint?.telefono ?? '')
      setCorreo(hint?.correo ?? '')
      setError('')
    }
  }, [open, hint])

  const crear = useMutation({
    mutationFn: () => proveedoresApi.create({ empresa_id: empresaId, nombre, rtn: rtn || null, telefono: telefono || null, correo: correo || null, activo: true }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['proveedores-all', empresaId] })
      onCreado(res.data.data)
      onClose()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Nuevo proveedor" size="sm">
      <div className="space-y-4">
        <Input label="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Distribuidora XYZ" autoFocus />
        <Input label="RTN" value={rtn} onChange={e => setRtn(e.target.value)} placeholder="0801-1990-12345" />
        <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+504 9999-9999" />
        <Input label="Correo" type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="ventas@proveedor.com" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="button" onClick={() => crear.mutate()} loading={crear.isPending} disabled={!nombre.trim()} className="flex-1">
            Crear proveedor
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Crear producto rápido ─────────────────────────────────────────────

interface CrearProductoProps {
  open: boolean
  onClose: () => void
  empresaId: number
  nombreInicial: string
  costoInicial: string
  onCreado: (p: Producto) => void
}

function CrearProductoModal({ open, onClose, empresaId, nombreInicial, costoInicial, onCreado }: CrearProductoProps) {
  const qc = useQueryClient()
  const [nombre,       setNombre]       = useState('')
  const [costo,        setCosto]        = useState('')
  const [precioVenta,  setPrecioVenta]  = useState('')
  const [tasaIsv,      setTasaIsv]      = useState('15')
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (open) { setNombre(nombreInicial); setCosto(costoInicial); setPrecioVenta(''); setTasaIsv('15'); setError('') }
  }, [open, nombreInicial, costoInicial])

  const crear = useMutation({
    mutationFn: () => productosApi.create({
      empresa_id:        empresaId,
      nombre,
      costo:             Number(costo),
      precio_venta:      Number(precioVenta),
      tasa_isv:          Number(tasaIsv),
      stock_minimo:      0,
      maneja_lote:       false,
      maneja_vencimiento: false,
      maneja_serie:      false,
      activo:            true,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['productos-all', empresaId] })
      onCreado(res.data.data)
      onClose()
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Nuevo producto" size="sm">
      <div className="space-y-4">
        <Input label="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del producto" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Costo *" type="number" step="0.01" min="0" value={costo} onChange={e => setCosto(e.target.value)} placeholder="0.00" />
          <Input label="Precio de venta *" type="number" step="0.01" min="0" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} placeholder="0.00" />
        </div>
        <Input label="Tasa ISV (%)" type="number" step="0.01" min="0" value={tasaIsv} onChange={e => setTasaIsv(e.target.value)} placeholder="15" />
        <p className="text-xs text-[#5F6B7A]">Puedes completar el resto de los campos (categoría, código, etc.) desde el catálogo de productos.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            type="button"
            onClick={() => crear.mutate()}
            loading={crear.isPending}
            disabled={!nombre.trim() || !costo || !precioVenta}
            className="flex-1"
          >
            Crear producto
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Panel de escaneo con IA ──────────────────────────────────────────────────

interface ScanPanelProps {
  proveedores: Proveedor[]
  onExtracted: (data: FacturaEscaneada, proveedorId: string) => void
}

function ScanPanel({ proveedores, onExtracted }: ScanPanelProps) {
  const [open,      setOpen]      = useState(false)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [file,      setFile]      = useState<File | null>(null)
  const [scanning,  setScanning]  = useState(false)
  const [scanError, setScanError] = useState('')
  const [done,      setDone]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setPreview(f.type === 'application/pdf' ? null : URL.createObjectURL(f))
    setScanError(''); setDone(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) handleFile(f)
  }

  async function handleScan() {
    if (!file) return
    setScanning(true); setScanError('')
    try {
      const { data, media_type } = await fileToBase64(file)
      const res = await comprasApi.escanear(data, media_type)
      const extracted = res.data.data
      const rtnExtraido   = (extracted.proveedor_rtn ?? '').replace(/[-\s]/g, '').toLowerCase()
      const nombreExtraido = (extracted.proveedor    ?? '').toLowerCase().trim()

      const match = proveedores.find(p => {
        // RTN es el identificador más confiable
        if (rtnExtraido && p.rtn) {
          if (p.rtn.replace(/[-\s]/g, '').toLowerCase() === rtnExtraido) return true
        }
        // Fallback: nombre
        if (nombreExtraido) {
          const n = p.nombre.toLowerCase()
          return n.includes(nombreExtraido) || nombreExtraido.includes(n)
        }
        return false
      })

      onExtracted(extracted, match ? String(match.id) : '')
      setDone(true)
    } catch (err) {
      setScanError(getAxiosError(err))
    } finally {
      setScanning(false)
    }
  }

  function reset() { setFile(null); setPreview(null); setScanError(''); setDone(false); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div className="bg-gradient-to-r from-[#072B5A]/5 to-[#0E78D8]/5 border border-[#0E78D8]/20 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#0E78D8]/5 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-[#0E78D8] flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#072B5A]">Escanear factura con IA</p>
          <p className="text-xs text-[#5F6B7A]">Sube una foto y el formulario se llena automáticamente</p>
        </div>
        <span className="text-xs text-[#0E78D8] font-semibold">{open ? 'Cerrar' : 'Abrir'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#0E78D8]/15">
          <div className="h-3" />
          {!file ? (
            <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#0E78D8]/30 rounded-xl p-8 text-center cursor-pointer hover:border-[#0E78D8]/60 hover:bg-[#0E78D8]/5 transition-all">
              <Camera size={32} className="text-[#0E78D8]/50 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#072B5A]">Arrastra un archivo o haz clic para seleccionar</p>
              <p className="text-xs text-[#5F6B7A] mt-1">JPG, PNG, WebP o PDF · Máx. 10 MB</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="flex gap-4 items-start">
              <div className="relative shrink-0">
                {preview
                  ? <img src={preview} alt="Factura" className="w-36 h-36 object-cover rounded-xl border border-gray-200 shadow-sm" />
                  : <div className="w-36 h-36 rounded-xl border border-gray-200 bg-red-50 flex flex-col items-center justify-center gap-2 shadow-sm">
                      <FileText size={36} className="text-red-500" />
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">PDF</span>
                    </div>
                }
                <button type="button" onClick={reset}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow">
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-semibold text-[#072B5A]">{file?.name}</p>
                <p className="text-xs text-[#5F6B7A]">{file ? (file.size / 1024).toFixed(0) : 0} KB</p>
                {done ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 size={15} /> Datos extraídos. Revisa los campos antes de guardar.
                  </div>
                ) : (
                  <button type="button" onClick={handleScan} disabled={scanning}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${scanning ? 'bg-gray-100 text-[#5F6B7A] cursor-not-allowed' : 'bg-[#0E78D8] text-white hover:bg-[#0B69C2] shadow-sm'}`}>
                    {scanning ? <><Loader2 size={15} className="animate-spin" /> Analizando...</> : <><Sparkles size={15} /> Extraer datos</>}
                  </button>
                )}
                {scanError && (
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" /> {scanError}
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="text-[11px] text-[#5F6B7A]">La imagen se envía a Claude AI. Siempre revisa los datos antes de guardar.</p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function ComprasPage() {
  const { state } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const [form, setForm] = useState({ proveedor_id: '', bodega_id: '', fecha_compra: todayISO(), numero_factura: '', descuento: '', impuesto: '' })
  const [lineas, setLineas] = useState<LineaItem[]>([emptyLinea()])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [proveedorHint, setProveedorHint] = useState<ProveedorHint | null>(null)

  // Modales de creación rápida
  const [modalProv, setModalProv] = useState(false)
  const [modalProd, setModalProd] = useState<{ idx: number; nombre: string; costo: string } | null>(null)

  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores-all', empresaId], queryFn: () => proveedoresApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas = [] }     = useQuery({ queryKey: ['bodegas-all', empresaId],     queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data),     enabled: empresaId > 0 })
  const { data: productos = [] }   = useQuery({ queryKey: ['productos-all', empresaId],   queryFn: () => productosApi.list({ empresa_id: empresaId, per_page: 500, activo: true }).then(r => r.data.data), enabled: empresaId > 0 })

  const crear = useMutation({
    mutationFn: (payload: unknown) => comprasApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      setForm({ proveedor_id: '', bodega_id: '', fecha_compra: todayISO(), numero_factura: '', descuento: '', impuesto: '' })
      setLineas([emptyLinea()])
      setError(''); setProveedorHint(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    },
    onError: (err) => setError(getAxiosError(err)),
  })

  function handleExtracted(data: FacturaEscaneada, proveedorId: string) {
    setForm(f => ({
      ...f,
      proveedor_id:   proveedorId || f.proveedor_id,
      numero_factura: data.numero_factura ?? f.numero_factura,
      fecha_compra:   data.fecha        ?? f.fecha_compra,
      descuento:      data.descuento != null ? String(data.descuento) : f.descuento,
      impuesto:       data.impuesto  != null ? String(data.impuesto)  : f.impuesto,
    }))
    if (!proveedorId && data.proveedor) {
      setProveedorHint({
        nombre:   data.proveedor,
        rtn:      data.proveedor_rtn      ?? null,
        telefono: data.proveedor_telefono ?? null,
        correo:   data.proveedor_correo   ?? null,
      })
    } else {
      setProveedorHint(null)
    }
    if (data.items?.length) {
      setLineas(data.items.map(item => {
        const codigoItem  = (item.codigo      ?? '').trim().toLowerCase()
        const nombreItem  = (item.descripcion ?? '').trim().toLowerCase()

        const match = productos.find(p => {
          if (codigoItem) {
            if ((p.codigo       ?? '').toLowerCase() === codigoItem) return true
            if ((p.codigo_barra ?? '').toLowerCase() === codigoItem) return true
          }
          if (nombreItem) {
            const n = p.nombre.toLowerCase()
            return n.includes(nombreItem) || nombreItem.includes(n)
          }
          return false
        })

        return {
          producto_id:    match ? String(match.id) : '',
          cantidad:       String(item.cantidad       ?? ''),
          costo_unitario: String(item.precio_unitario ?? ''),
          lote: '', fecha_vencimiento: '',
          hint: match ? '' : item.descripcion,
          bulto: false, cant_bultos: '', unidades_por_bulto: '', costo_por_bulto: '',
        }
      }))
    }
  }

  function abrirModalProv() {
    setModalProv(true)
  }

  function abrirModalProd(idx: number) {
    const l = lineas[idx]
    setModalProd({ idx, nombre: l.hint ?? '', costo: l.costo_unitario })
  }

  const setLinea = (i: number, field: keyof LineaItem, value: string) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  function toggleBulto(i: number) {
    setLineas(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      if (l.bulto) return { ...l, bulto: false, cant_bultos: '', unidades_por_bulto: '', costo_por_bulto: '' }
      return { ...l, bulto: true, cantidad: '', costo_unitario: '' }
    }))
  }

  function setBultoLinea(i: number, field: 'cant_bultos' | 'unidades_por_bulto' | 'costo_por_bulto', value: string) {
    setLineas(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, [field]: value }
      const bultos    = Number(field === 'cant_bultos'         ? value : l.cant_bultos)       || 0
      const unidades  = Number(field === 'unidades_por_bulto'  ? value : l.unidades_por_bulto) || 0
      const costoCaja = Number(field === 'costo_por_bulto'     ? value : l.costo_por_bulto)   || 0
      return {
        ...next,
        cantidad:       bultos && unidades  ? String(bultos * unidades)              : next.cantidad,
        costo_unitario: costoCaja && unidades ? String((costoCaja / unidades).toFixed(4)) : next.costo_unitario,
      }
    }))
  }

  const subtotal = lineas.reduce((s, l) => s + (Number(l.cantidad) * Number(l.costo_unitario) || 0), 0)
  const total    = subtotal - (Number(form.descuento) || 0) + (Number(form.impuesto) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.proveedor_id || !form.bodega_id || !form.fecha_compra) { setError('Completa los campos requeridos.'); return }
    if (lineas.some(l => !l.producto_id || !l.cantidad || !l.costo_unitario)) { setError('Cada línea necesita producto, cantidad y costo unitario.'); return }
    try {
      await crear.mutateAsync({
        empresa_id: empresaId, proveedor_id: Number(form.proveedor_id), bodega_id: Number(form.bodega_id),
        fecha_compra: form.fecha_compra, numero_factura: form.numero_factura || null,
        descuento: form.descuento ? Number(form.descuento) : 0, impuesto: form.impuesto ? Number(form.impuesto) : 0,
        detalles: lineas.map(l => ({
          producto_id: Number(l.producto_id), cantidad: Number(l.cantidad), costo_unitario: Number(l.costo_unitario),
          lote: l.lote || null, fecha_vencimiento: l.fecha_vencimiento || null,
        })),
      })
    } catch { /* onError handles it */ }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#072B5A]">Nueva orden de compra</h1>
          <p className="text-sm text-[#5F6B7A]">Registra una compra a proveedor — queda como pendiente hasta que la recibas</p>
        </div>
        <Link to="/compras/historial">
          <Button variant="secondary" icon={<ClipboardList size={15} />}>Historial</Button>
        </Link>
      </div>

      <ScanPanel proveedores={proveedores} onExtracted={handleExtracted} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Encabezado */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wide mb-4">Información general</p>
          <div className="grid grid-cols-3 gap-4">
            {/* Proveedor con botón crear */}
            <div className="flex flex-col gap-1">
              <Select
                label="Proveedor *"
                options={proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                placeholder="Seleccionar"
                value={form.proveedor_id}
                onChange={e => setForm(f => ({ ...f, proveedor_id: (e.target as HTMLSelectElement).value }))}
                required
              />
              <div className="flex items-center justify-between">
                {proveedorHint && !form.proveedor_id && (
                  <p className="text-[11px] text-amber-700 truncate max-w-[160px]" title={proveedorHint.nombre}>
                    IA: "{proveedorHint.nombre}"
                  </p>
                )}
                {!form.proveedor_id && (
                  <button type="button" onClick={abrirModalProv}
                    className="ml-auto text-[11px] text-[#0E78D8] hover:underline font-semibold whitespace-nowrap">
                    + Crear proveedor
                  </button>
                )}
              </div>
            </div>

            <Select
              label="Bodega destino *"
              options={bodegas.map(b => ({ value: b.id, label: b.nombre }))}
              placeholder="Seleccionar"
              value={form.bodega_id}
              onChange={e => setForm(f => ({ ...f, bodega_id: (e.target as HTMLSelectElement).value }))}
              required
            />
            <Input label="Fecha *" type="date" value={form.fecha_compra} onChange={e => setForm(f => ({ ...f, fecha_compra: e.target.value }))} required />
            <Input label="N° Factura proveedor" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FAC-001" />
            <Input label="Descuento" type="number" step="0.01" min="0" value={form.descuento} onChange={e => setForm(f => ({ ...f, descuento: e.target.value }))} placeholder="0.00" />
            <Input label="Impuesto / ISV" type="number" step="0.01" min="0" value={form.impuesto} onChange={e => setForm(f => ({ ...f, impuesto: e.target.value }))} placeholder="0.00" />
          </div>
        </div>

        {/* Líneas de productos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Productos</p>
            <button type="button" onClick={() => setLineas(p => [...p, emptyLinea()])}
              className="text-xs text-[#0E78D8] hover:text-[#072B5A] font-semibold flex items-center gap-1 transition-colors">
              <Plus size={13} /> Agregar línea
            </button>
          </div>

          <div className="space-y-2">
            {lineas.map((l, i) => {
              const prod = productos.find(p => String(p.id) === l.producto_id)
              return (
                <div key={i} className="bg-[#F4F7FA] rounded-lg">
                  <div className="grid grid-cols-12 gap-2 items-end p-3">
                    <div className="col-span-4">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Producto *</p>}
                      <select value={l.producto_id} onChange={e => setLinea(i, 'producto_id', e.target.value)} required className={`${inputCls} text-[#072B5A]`}>
                        <option value="">{l.hint ? `— ${l.hint}` : 'Seleccionar'}</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                      <div className="flex items-center justify-between mt-0.5">
                        {l.hint && !l.producto_id && (
                          <p className="text-[10px] text-[#0E78D8] truncate max-w-[120px]" title={l.hint}>IA: {l.hint}</p>
                        )}
                        {!l.producto_id && (
                          <button type="button" onClick={() => abrirModalProd(i)}
                            className="ml-auto text-[10px] text-[#0E78D8] hover:underline font-semibold whitespace-nowrap">
                            + Crear producto
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cantidad *</p>}
                      <input type="number" step="any" min="0.0001" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} required placeholder="0"
                        readOnly={l.bulto}
                        className={`${inputCls} ${l.bulto ? 'bg-gray-50 text-[#5F6B7A]' : ''}`} />
                      <button type="button" onClick={() => toggleBulto(i)}
                        className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold transition-colors ${l.bulto ? 'text-amber-600 hover:text-amber-800' : 'text-[#0E78D8] hover:text-[#072B5A]'}`}>
                        <Package size={10} />
                        {l.bulto ? 'Desactivar modo caja' : 'Comprado en caja'}
                      </button>
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo unit. *</p>}
                      <input type="number" step="0.01" min="0" value={l.costo_unitario} onChange={e => setLinea(i, 'costo_unitario', e.target.value)} required placeholder="0.00"
                        readOnly={l.bulto}
                        className={`${inputCls} ${l.bulto ? 'bg-gray-50 text-[#5F6B7A]' : ''}`} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Subtotal</p>}
                      <div className="px-2 py-2 text-sm font-semibold text-[#072B5A] bg-white border border-gray-100 rounded-lg">
                        {formatCurrency(Number(l.cantidad) * Number(l.costo_unitario) || 0)}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      {lineas.length > 1 && (
                        <button type="button" onClick={() => setLineas(p => p.filter((_, idx) => idx !== i))}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {prod && (prod.maneja_lote || prod.maneja_vencimiento) && (
                    <div className="flex gap-3 px-3 pb-3 -mt-1">
                      {prod.maneja_lote && (
                        <div className="w-40">
                          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Lote</p>
                          <input value={l.lote} onChange={e => setLinea(i, 'lote', e.target.value)} placeholder="LOT-001" className={inputCls} />
                        </div>
                      )}
                      {prod.maneja_vencimiento && (
                        <div className="w-44">
                          <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Fecha vencimiento</p>
                          <input type="date" value={l.fecha_vencimiento} onChange={e => setLinea(i, 'fecha_vencimiento', e.target.value)} className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}

                  {l.bulto && (
                    <div className="px-3 pb-3 -mt-1">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Package size={10} /> Conversión caja → unidad
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Cajas / bultos</p>
                            <input type="number" step="any" min="0.0001" value={l.cant_bultos}
                              onChange={e => setBultoLinea(i, 'cant_bultos', e.target.value)}
                              placeholder="1" className={inputCls} />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Unidades por caja</p>
                            <input type="number" step="any" min="1" value={l.unidades_por_bulto}
                              onChange={e => setBultoLinea(i, 'unidades_por_bulto', e.target.value)}
                              placeholder="12" className={inputCls} />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-[#5F6B7A] uppercase tracking-wide mb-1">Costo por caja</p>
                            <input type="number" step="0.01" min="0" value={l.costo_por_bulto}
                              onChange={e => setBultoLinea(i, 'costo_por_bulto', e.target.value)}
                              placeholder="0.00" className={inputCls} />
                          </div>
                        </div>
                        {l.cantidad && l.costo_unitario && (
                          <p className="text-[10px] text-amber-700 font-semibold mt-2">
                            → {l.cantidad} unidades · {formatCurrency(Number(l.costo_unitario))} c/u
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="bg-[#F4F7FA] rounded-xl p-4 min-w-56 space-y-1.5">
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Descuento</span><span className="font-medium text-red-500">− {formatCurrency(Number(form.descuento) || 0)}</span></div>
              <div className="flex justify-between text-sm text-[#5F6B7A]"><span>Impuesto</span><span className="font-medium">{formatCurrency(Number(form.impuesto) || 0)}</span></div>
              <div className="flex justify-between text-base font-bold text-[#072B5A] pt-1.5 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {success && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              ✓ Orden registrada. Puedes recibirla desde el historial cuando llegue la mercancía.
            </div>
          )}
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
          <div className="flex justify-end">
            <Button type="submit" loading={crear.isPending} icon={<ShoppingCart size={15} />}>Registrar orden de compra</Button>
          </div>
        </div>
      </form>

      {/* Modales */}
      <CrearProveedorModal
        open={modalProv}
        onClose={() => setModalProv(false)}
        empresaId={empresaId}
        hint={proveedorHint}
        onCreado={p => {
          setForm(f => ({ ...f, proveedor_id: String(p.id) }))
          setProveedorHint(null)
        }}
      />

      {modalProd && (
        <CrearProductoModal
          open={true}
          onClose={() => setModalProd(null)}
          empresaId={empresaId}
          nombreInicial={modalProd.nombre}
          costoInicial={modalProd.costo}
          onCreado={p => {
            setLinea(modalProd.idx, 'producto_id', String(p.id))
            setModalProd(null)
          }}
        />
      )}
    </div>
  )
}
