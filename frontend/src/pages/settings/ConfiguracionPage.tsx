import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Upload, Trash2, Save, ImageOff } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { empresaApi } from '@/api/recursos'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getAxiosError } from '@/lib/utils'
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
  }

  /* ── Guardar datos ──────────────────────────────────────────── */
  const guardar = useMutation({
    mutationFn: () => empresaApi.update(empresaId, {
      ...form,
      isv_rate: parseFloat(form.isv_rate) || 0,
      rubro: (form.rubro as Rubro) || null,
    }),
    onSuccess: (res) => {
      setSaveOk(true); setSaveError('')
      setTimeout(() => setSaveOk(false), 3000)
      // Actualiza nombre y rubro en el auth state
      setEmpresa({ ...state.empresaActiva!, nombre: res.data.data.nombre, rubro: res.data.data.rubro ?? null })
      qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
    },
    onError: (err) => { setSaveError(getAxiosError(err)); setSaveOk(false) },
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
        <h1 className="text-xl font-bold text-[#072B5A]">Configuración de empresa</h1>
        <p className="text-sm text-[#5F6B7A]">Datos que aparecerán en tus facturas y cotizaciones</p>
      </div>

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[#072B5A] mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-[#0E78D8]" /> Logo de la empresa
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
        <h2 className="text-sm font-bold text-[#072B5A] mb-4">Datos generales</h2>

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
    </div>
  )
}
