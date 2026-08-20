import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Upload, Trash2, Save, ImageOff, FileText, Printer, Palette } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { empresaApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getAxiosError } from '@/lib/utils'
import { applyTheme } from '@/lib/theme'
import type { Rubro } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function ConfiguracionPage() {
  const { state, setEmpresa } = useAuth()
  const empresaId = state.empresaActiva?.id ?? 0
  const qc = useQueryClient()

  const fileRef = useRef<HTMLInputElement>(null)
  const [saveError,   setSaveError]   = useState('')
  const [saveOk,      setSaveOk]      = useState(false)
  const [logoError,   setLogoError]   = useState('')
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)

  /* ── Datos empresa ──────────────────────────────────────────── */
  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn:  () => empresaApi.get(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const [form, setForm] = useState({ nombre: '', nombre_legal: '', rtn: '', correo: '', telefono: '', direccion: '', isv_rate: '15', rubro: '' })
  const [configCot, setConfigCot] = useState({ mostrar_descripcion: false, mostrar_foto: false })
  const [tipoFacturacion, setTipoFacturacion] = useState<'factura_a4' | 'ticket'>('factura_a4')
  const [colorPrimario,   setColorPrimario]   = useState('var(--cp)')
  const [colorSecundario, setColorSecundario] = useState('var(--cs)')

  // Inicializar form cuando llegan los datos
  const initialized = useRef(false)
  if (empresa && !initialized.current) {
    initialized.current = true
    setForm({
      nombre:       empresa.nombre       ?? '',
      nombre_legal: empresa.nombre_legal ?? '',
      rtn:          empresa.rtn          ?? '',
      correo:       empresa.correo       ?? '',
      telefono:     empresa.telefono     ?? '',
      direccion:    empresa.direccion    ?? '',
      isv_rate:     String(empresa.isv_rate ?? 15),
      rubro:        empresa.rubro        ?? '',
    })
    setConfigCot({
      mostrar_descripcion: empresa.config_cotizacion?.mostrar_descripcion ?? false,
      mostrar_foto:        empresa.config_cotizacion?.mostrar_foto        ?? false,
    })
    setTipoFacturacion((empresa.tipo_facturacion ?? 'factura_a4') as 'factura_a4' | 'ticket')
    setColorPrimario(empresa.color_primario   ?? 'var(--cp)')
    setColorSecundario(empresa.color_secundario ?? 'var(--cs)')
  }

  /* ── Guardar datos generales + cotizaciones ─────────────────── */
  const guardar = useMutation({
    mutationFn: () => empresaApi.update(empresaId, {
      ...form,
      isv_rate: parseFloat(form.isv_rate) || 0,
      rubro: (form.rubro as Rubro) || null,
      config_cotizacion: configCot,
      tipo_facturacion: tipoFacturacion,
    }),
    onSuccess: (res) => {
      setSaveOk(true); setSaveError('')
      setTimeout(() => setSaveOk(false), 3000)
      setEmpresa({ ...state.empresaActiva!, nombre: res.data.data.nombre, rubro: res.data.data.rubro ?? null })
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => { setSaveError(getAxiosError(err)); setSaveOk(false) },
  })

  /* ── Guardar formato de facturación (mutación independiente) ─ */
  const [facturacionOk,    setFacturacionOk]    = useState(false)
  const [facturacionError, setFacturacionError] = useState('')
  const guardarFacturacion = useMutation({
    mutationFn: (tipo: 'ticket' | 'factura_a4') => empresaApi.update(empresaId, {
      ...form,
      isv_rate: parseFloat(form.isv_rate) || 0,
      rubro: (form.rubro as Rubro) || null,
      config_cotizacion: configCot,
      tipo_facturacion: tipo,
    }),
    onSuccess: () => {
      setFacturacionOk(true); setFacturacionError('')
      setTimeout(() => setFacturacionOk(false), 3000)
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => { setFacturacionError(getAxiosError(err)); setFacturacionOk(false) },
  })

  /* ── Guardar colores ────────────────────────────────────────── */
  const [coloresOk,    setColoresOk]    = useState(false)
  const [coloresError, setColoresError] = useState('')
  const guardarColores = useMutation({
    mutationFn: (colores: { color_primario: string; color_secundario: string }) =>
      empresaApi.update(empresaId, {
        ...form,
        isv_rate: parseFloat(form.isv_rate) || 0,
        rubro: (form.rubro as Rubro) || null,
        config_cotizacion: configCot,
        tipo_facturacion: tipoFacturacion,
        ...colores,
      }),
    onSuccess: (_, vars) => {
      setColoresOk(true); setColoresError('')
      setTimeout(() => setColoresOk(false), 3000)
      applyTheme(vars.color_primario, vars.color_secundario)
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => { setColoresError(getAxiosError(err)); setColoresOk(false) },
  })

  /* ── Subir logo ─────────────────────────────────────────────── */
  const subirLogo = useMutation({
    mutationFn: (file: File) => empresaApi.uploadLogo(empresaId, file),
    onSuccess: (res) => {
      setLogoError(''); setPreviewUrl(null)
      const logoUrl = res.data.data.logo_url
      setEmpresa({ ...state.empresaActiva!, logo_url: logoUrl })
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => setLogoError(getAxiosError(err)),
  })

  /* ── Eliminar logo ──────────────────────────────────────────── */
  const eliminarLogo = useMutation({
    mutationFn: () => empresaApi.deleteLogo(empresaId),
    onSuccess: () => {
      setLogoError(''); setPreviewUrl(null)
      setEmpresa({ ...state.empresaActiva!, logo_url: null })
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => setLogoError(getAxiosError(err)),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    subirLogo.mutate(file)
    e.target.value = ''
  }

  const logoUrl = empresa?.logo_url
    ? (empresa.logo_url.startsWith('http') ? empresa.logo_url : `${API_BASE}${empresa.logo_url}`)
    : null

  if (isLoading) return <div className="p-8 text-[#5F6B7A]">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--cs)]">Configuración de empresa</h1>
        <p className="text-sm text-[#5F6B7A]">Datos que aparecerán en tus facturas y cotizaciones</p>
      </div>

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[var(--cs)] mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-[var(--cp)]" /> Logo de la empresa
        </h2>

        <div className="flex items-center gap-6">
          {/* Vista previa */}
          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {previewUrl || logoUrl
              ? <img src={previewUrl ?? logoUrl!} alt="Logo" className="w-full h-full object-contain p-2" />
              : <ImageOff size={28} className="text-gray-300" />
            }
          </div>

          <div className="space-y-2 flex-1">
            <p className="text-xs text-[#5F6B7A]">JPG, PNG, WEBP o SVG · Máximo 2 MB · Recomendado 200×200 px</p>
            <div className="flex gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleFileChange} />
              <Button
                size="sm"
                icon={<Upload size={14} />}
                loading={subirLogo.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {logoUrl && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  loading={eliminarLogo.isPending}
                  onClick={() => eliminarLogo.mutate()}
                >
                  Eliminar
                </Button>
              )}
            </div>
            {logoError && <p className="text-xs text-red-600">{logoError}</p>}
            {subirLogo.isSuccess && <p className="text-xs text-emerald-600">Logo actualizado correctamente.</p>}
          </div>
        </div>
      </div>

      {/* ── Datos generales ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[var(--cs)] mb-4">Datos generales</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre comercial *" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <Input label="Nombre legal" value={form.nombre_legal}
            onChange={e => setForm(f => ({ ...f, nombre_legal: e.target.value }))} />
          <Input label="RTN / NIT" value={form.rtn}
            onChange={e => setForm(f => ({ ...f, rtn: e.target.value }))} />
          <Input label="Correo" type="email" value={form.correo}
            onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
          <Input label="Teléfono" value={form.telefono}
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <div className="sm:col-span-2">
            <Input label="Dirección" value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div>
            <Input label="ISV / Impuesto (%)" type="number" min="0" max="100" step="0.01"
              value={form.isv_rate}
              onChange={e => setForm(f => ({ ...f, isv_rate: e.target.value }))}
              placeholder="15" />
            <p className="mt-1 text-xs text-[#5F6B7A]">Se aplica a ventas y cotizaciones. Ej: 15 para ISV hondureño.</p>
          </div>
        </div>

{saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
        {saveOk    && <p className="mt-3 text-sm text-emerald-600">Cambios guardados correctamente.</p>}

        <div className="mt-5 flex justify-end">
          <Button icon={<Save size={15} />} loading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* ── Configuración de cotizaciones ──────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[var(--cs)] mb-1 flex items-center gap-2">
          <FileText size={16} className="text-[var(--cp)]" /> Configuración de cotizaciones
        </h2>
        <p className="text-xs text-[#5F6B7A] mb-5">Elige qué información mostrar en el PDF de cada cotización.</p>

        <div className="space-y-4">
          {/* Toggle: mostrar descripción */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-gray-100 bg-[#F4F7FA]">
            <div>
              <p className="text-sm font-semibold text-[var(--cs)]">Mostrar descripción del producto</p>
              <p className="text-xs text-[#5F6B7A] mt-0.5">Incluye la descripción debajo del nombre en la tabla de productos.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfigCot(c => ({ ...c, mostrar_descripcion: !c.mostrar_descripcion }))}
              style={{ height: '24px', width: '44px' }}
              className={`rounded-full flex items-center px-0.5 transition-colors shrink-0 ml-4 ${configCot.mostrar_descripcion ? 'bg-[var(--cp)]' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${configCot.mostrar_descripcion ? 'translate-x-[20px]' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Toggle: mostrar foto */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-gray-100 bg-[#F4F7FA]">
            <div>
              <p className="text-sm font-semibold text-[var(--cs)]">Mostrar foto del producto</p>
              <p className="text-xs text-[#5F6B7A] mt-0.5">Muestra la imagen del producto en cada fila si está disponible.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfigCot(c => ({ ...c, mostrar_foto: !c.mostrar_foto }))}
              style={{ height: '24px', width: '44px' }}
              className={`rounded-full flex items-center px-0.5 transition-colors shrink-0 ml-4 ${configCot.mostrar_foto ? 'bg-[var(--cp)]' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${configCot.mostrar_foto ? 'translate-x-[20px]' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button icon={<Save size={15} />} loading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* ── Tipo de facturación ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[var(--cs)] mb-1 flex items-center gap-2">
          <Printer size={16} className="text-[var(--cp)]" /> Formato de facturas
        </h2>
        <p className="text-xs text-[#5F6B7A] mb-5">Elige el formato que se usará al imprimir facturas de venta.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Opción A4 */}
          <button
            type="button"
            onClick={() => setTipoFacturacion('factura_a4')}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
              tipoFacturacion === 'factura_a4'
                ? 'border-[var(--cp)] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-[#F4F7FA]'
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              tipoFacturacion === 'factura_a4' ? 'border-[var(--cp)]' : 'border-gray-400'
            }`}>
              {tipoFacturacion === 'factura_a4' && <div className="w-2 h-2 rounded-full bg-[var(--cp)]" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--cs)]">Factura A4</p>
              <p className="text-xs text-[#5F6B7A] mt-0.5">Formato carta completo, con logo y tabla de productos. Ideal para impresoras de oficina.</p>
            </div>
          </button>

          {/* Opción Ticket */}
          <button
            type="button"
            onClick={() => setTipoFacturacion('ticket')}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
              tipoFacturacion === 'ticket'
                ? 'border-[var(--cp)] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-[#F4F7FA]'
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              tipoFacturacion === 'ticket' ? 'border-[var(--cp)]' : 'border-gray-400'
            }`}>
              {tipoFacturacion === 'ticket' && <div className="w-2 h-2 rounded-full bg-[var(--cp)]" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--cs)]">Ticket 80mm</p>
              <p className="text-xs text-[#5F6B7A] mt-0.5">Formato angosto estilo supermercado o restaurante. Ideal para impresoras térmicas de 80 mm.</p>
            </div>
          </button>
        </div>

        {facturacionError && <p className="mt-3 text-sm text-red-600">{facturacionError}</p>}
        {facturacionOk    && <p className="mt-3 text-sm text-emerald-600">Formato guardado correctamente.</p>}

        <div className="mt-5 flex justify-end">
          <Button
            icon={<Save size={15} />}
            loading={guardarFacturacion.isPending}
            onClick={() => guardarFacturacion.mutate(tipoFacturacion)}
          >
            Guardar formato
          </Button>
        </div>
      </div>

      {/* ── Colores del sistema ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-[var(--cs)] flex items-center gap-2 mb-5">
          <Palette size={16} style={{ color: 'var(--cp)' }} /> Colores del sistema
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Color primario */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Color primario
            </label>
            <p className="text-xs text-gray-400 mb-3">Botones, íconos activos, acentos.</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorPrimario}
                onChange={e => { setColorPrimario(e.target.value); applyTheme(e.target.value, colorSecundario) }}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={colorPrimario}
                onChange={e => {
                  const v = e.target.value
                  setColorPrimario(v)
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) applyTheme(v, colorSecundario)
                }}
                maxLength={7}
                className="w-28 font-mono text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]"
              />
              <div className="w-8 h-8 rounded-lg border border-gray-100 shadow-sm" style={{ background: colorPrimario }} />
            </div>
          </div>

          {/* Color secundario */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Color secundario
            </label>
            <p className="text-xs text-gray-400 mb-3">Sidebar, encabezados, textos oscuros.</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorSecundario}
                onChange={e => { setColorSecundario(e.target.value); applyTheme(colorPrimario, e.target.value) }}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={colorSecundario}
                onChange={e => {
                  const v = e.target.value
                  setColorSecundario(v)
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) applyTheme(colorPrimario, v)
                }}
                maxLength={7}
                className="w-28 font-mono text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)]"
              />
              <div className="w-8 h-8 rounded-lg border border-gray-100 shadow-sm" style={{ background: colorSecundario }} />
            </div>
          </div>
        </div>

        {/* Preview rápido */}
        <div className="mt-5 p-4 rounded-lg border border-gray-100 bg-gray-50 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full" style={{ background: colorSecundario }} />
          <div className="flex-1 h-2 rounded-full" style={{ background: colorPrimario }} />
          <button className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: colorPrimario }}>
            Botón
          </button>
        </div>

        {coloresError && <p className="mt-3 text-sm text-red-600">{coloresError}</p>}
        {coloresOk    && <p className="mt-3 text-sm text-emerald-600">Colores guardados correctamente.</p>}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => { setColorPrimario('var(--cp)'); setColorSecundario('var(--cs)'); applyTheme('var(--cp)', 'var(--cs)') }}
          >
            Restaurar colores por defecto
          </button>
          <Button
            icon={<Save size={15} />}
            loading={guardarColores.isPending}
            onClick={() => guardarColores.mutate({ color_primario: colorPrimario, color_secundario: colorSecundario })}
          >
            Guardar colores
          </Button>
        </div>
      </div>
    </div>
  )
}
