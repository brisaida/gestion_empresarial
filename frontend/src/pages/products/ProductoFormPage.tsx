import { useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, X, ScanBarcode, Camera, CameraOff } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { productosApi, categoriasApi, marcasApi, unidadesApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'
import { BrowserMultiFormatReader } from '@zxing/browser'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { Producto } from '@/types'

const schema = z.object({
  nombre:             z.string().min(1, 'El nombre es requerido'),
  codigo:             z.string().optional(),
  codigo_barra:       z.string().optional(),
  descripcion:        z.string().optional(),
  categoria_ids:      z.array(z.number()).default([]),
  marca_id:           z.string().optional(),
  unidad_medida_id:   z.string().optional(),
  costo:              z.coerce.number().min(0),
  precio_venta:       z.coerce.number().min(0),
  tasa_isv:           z.union([z.coerce.number(), z.literal('')]).optional(),
  stock_minimo:       z.coerce.number().min(0).default(0),
  tamaño:             z.string().optional(),
  peso:               z.union([z.coerce.number(), z.literal('')]).optional(),
  largo:              z.union([z.coerce.number(), z.literal('')]).optional(),
  ancho:              z.union([z.coerce.number(), z.literal('')]).optional(),
  alto:               z.union([z.coerce.number(), z.literal('')]).optional(),
  maneja_lote:        z.boolean().default(false),
  maneja_vencimiento: z.boolean().default(false),
  maneja_serie:       z.boolean().default(false),
  activo:             z.boolean().default(true),
  tipo:               z.enum(['venta', 'ingrediente']).default('venta'),
})

type FormValues = z.infer<typeof schema>

export default function ProductoFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { state } = useAuth()
  const empresaId: number = state.empresaActiva?.id ?? 0

  // Image
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)

  // Barcode scanner state
  const [scannerOpen, setScannerOpen]     = useState(false)
  const [scannerError, setScannerError]   = useState('')
  const [scannerReady, setScannerReady]   = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  // API data
  const [apiError, setApiError] = useState('')

  const { data: cats }     = useQuery({ queryKey: ['cats-all', empresaId],     queryFn: () => categoriasApi.list({ empresa_id: empresaId, per_page: 100, solo_activos: true }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: marcas }   = useQuery({ queryKey: ['marcas-all', empresaId],   queryFn: () => marcasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: unidades } = useQuery({ queryKey: ['unidades-all', empresaId], queryFn: () => unidadesApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })

  const { data: producto, isLoading: loadingProducto } = useQuery({
    queryKey: ['producto', id],
    queryFn:  () => productosApi.get(Number(id)).then(r => r.data.data as Producto),
    enabled:  isEdit,
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { costo: 0, precio_venta: 0, stock_minimo: 0, activo: true },
  })

  useEffect(() => {
    if (producto) {
      reset({
        nombre:             producto.nombre,
        codigo:             producto.codigo ?? '',
        codigo_barra:       producto.codigo_barra ?? '',
        descripcion:        producto.descripcion ?? '',
        categoria_ids:      producto.categorias?.map(c => c.id) ?? [],
        marca_id:           String(producto.marca_id ?? ''),
        unidad_medida_id:   String(producto.unidad_medida_id ?? ''),
        costo:              producto.costo,
        precio_venta:       producto.precio_venta,
        tasa_isv:           producto.tasa_isv ?? '',
        stock_minimo:       producto.stock_minimo,
        tamaño:             producto.tamaño ?? '',
        peso:               producto.peso ?? '',
        largo:              producto.largo ?? '',
        ancho:              producto.ancho ?? '',
        alto:               producto.alto ?? '',
        maneja_lote:        producto.maneja_lote,
        maneja_vencimiento: producto.maneja_vencimiento,
        maneja_serie:       producto.maneja_serie,
        activo:             producto.activo,
        tipo:               producto.tipo ?? 'venta',
      })
      setImagePreview(producto.imagen_url ?? null)
    }
  }, [producto, reset])

  const createMut = useMutation({
    mutationFn: (data: unknown) => productosApi.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['productos'] }),
    onError:    (e) => setApiError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: (data: unknown) => productosApi.update(Number(id), data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['productos'] }),
    onError:    (e) => setApiError(getAxiosError(e)),
  })

  const prepareData = (v: FormValues) => ({
    ...v,
    empresa_id:       empresaId,
    categoria_ids:    v.categoria_ids ?? [],
    marca_id:         v.marca_id ? Number(v.marca_id) : null,
    unidad_medida_id: v.unidad_medida_id ? Number(v.unidad_medida_id) : null,
  })

  const onSubmit = async (v: FormValues) => {
    setApiError('')
    let productoId: number
    try {
      if (isEdit) {
        await updateMut.mutateAsync(prepareData(v))
        productoId = Number(id)
      } else {
        const res = await createMut.mutateAsync(prepareData(v))
        productoId = (res as { data: { data: Producto } }).data.data.id
      }
      if (imageFile) {
        setUploadingImg(true)
        try { await productosApi.uploadImagen(productoId, imageFile) }
        finally { setUploadingImg(false) }
        qc.invalidateQueries({ queryKey: ['productos'] })
      }
      navigate('/productos')
    } catch { /* error already set by mutation */ }
  }

  // ── Barcode scanner ─────────────────────────────────────────────────────
  const scannedRef = useRef(false)

  const stopTracks = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const stopScanner = useCallback(() => {
    stopTracks()
    try { readerRef.current?.reset() } catch { /* ignore */ }
    readerRef.current = null
    setScannerOpen(false)
    setScannerReady(false)
    setScannerError('')
  }, [stopTracks])

  const startScanner = useCallback(async () => {
    scannedRef.current = false
    setScannerError('')
    setScannerOpen(true)
    setScannerReady(false)

    await new Promise(r => setTimeout(r, 80))

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[0]
      if (!back) { setScannerError('No se encontró ninguna cámara.'); return }

      setScannerReady(true)

      // Sin await: la promesa se resuelve/rechaza cuando se llama reset(),
      // pero el callback puede actualizar estado React libremente
      reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result) => {
        if (result && !scannedRef.current) {
          scannedRef.current = true
          const code = result.getText()

          // 1. Detener tracks del stream
          stopTracks()

          // 2. Reset síncrono del reader dentro del callback (seguro: solo setea flag interno)
          //    Capturar en local para que no interfiera con futuros re-escaneos
          const doneReader = readerRef.current
          readerRef.current = null
          try { doneReader?.reset() } catch { /* el reject de la promesa es ignorado en .catch */ }

          // 3. flushSync fuerza re-render síncrono → quita el video del DOM inmediatamente
          flushSync(() => {
            setScannerOpen(false)
            setScannerReady(false)
          })

          setValue('codigo_barra', code, { shouldValidate: true })
        }
      }).catch(() => {
        // Dispara cuando reset() cancela el loop — ignorar si ya escaneamos
        if (!scannedRef.current) setScannerError('Error al acceder a la cámara.')
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/permission|notallowed/i.test(msg)) {
        setScannerError('Permiso de cámara denegado. Actívalo en la configuración del navegador.')
      } else {
        setScannerError('No se pudo acceder a la cámara.')
      }
    }
  }, [setValue, stopTracks])

  // Cleanup on unmount
  useEffect(() => () => { stopScanner() }, [stopScanner])

  if (isEdit && loadingProducto) {
    return (
      <div className="flex items-center justify-center h-48 text-[#5F6B7A] text-sm">
        Cargando producto…
      </div>
    )
  }

  const saving = isSubmitting || uploadingImg

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/productos')}
            className="p-2 rounded-lg text-[#5F6B7A] hover:text-[#072B5A] hover:bg-white border border-transparent hover:border-gray-200 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#072B5A]">
              {isEdit ? 'Editar producto' : 'Nuevo producto'}
            </h1>
            <p className="text-sm text-[#5F6B7A]">
              {isEdit ? producto?.nombre : 'Completa la información del producto'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/productos')}>Cancelar</Button>
          <Button loading={saving} onClick={handleSubmit(onSubmit)}>
            {saving ? (uploadingImg ? 'Subiendo imagen…' : 'Guardando…') : (isEdit ? 'Guardar cambios' : 'Crear producto')}
          </Button>
        </div>
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── Imagen ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide mb-4">Foto del producto</p>
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="preview" className="w-28 h-28 rounded-xl object-cover border border-gray-200 shadow-sm" />
                  {imageFile && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </>
              ) : (
                <div className="w-28 h-28 rounded-xl bg-[#F4F7FA] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
                  <ImagePlus size={24} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300 font-medium">Sin foto</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                id="imagen-input"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImageFile(file)
                  setImagePreview(URL.createObjectURL(file))
                }}
              />
              <label
                htmlFor="imagen-input"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-[#5F6B7A] hover:border-[#0E78D8] hover:text-[#0E78D8] cursor-pointer transition-all"
              >
                <ImagePlus size={15} />
                {imagePreview ? 'Cambiar foto' : 'Subir foto'}
              </label>
              <p className="text-xs text-gray-400">JPG, PNG o WebP · Máx. 2 MB</p>
            </div>
          </div>
        </div>

        {/* ── Información básica ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Información básica</p>

          <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Código interno" placeholder="P-001" {...register('codigo')} />

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Código de barras</label>
              <div className="flex gap-1.5">
                <input
                  {...register('codigo_barra')}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#072B5A]/20 focus:border-[#072B5A]"
                  placeholder="Escribe o escanea"
                />
                <button
                  type="button"
                  onClick={scannerOpen ? stopScanner : startScanner}
                  className={`p-2 rounded-lg border transition-colors ${
                    scannerOpen
                      ? 'border-[#072B5A] bg-[#072B5A] text-white'
                      : 'border-gray-200 text-gray-500 hover:text-[#072B5A] hover:border-[#072B5A] hover:bg-blue-50'
                  }`}
                  title={scannerOpen ? 'Cerrar escáner' : 'Escanear con cámara'}
                >
                  {scannerOpen ? <CameraOff size={18} /> : <ScanBarcode size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Visor de cámara — ancho completo, fuera del grid */}
          {scannerOpen && (
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                <video ref={videoRef} className="w-full h-full object-cover" />

                {scannerReady && !scannerError && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-3/4 h-24">
                      {(['tl','tr','bl','br'] as const).map(c => (
                        <span key={c} className={`absolute w-6 h-6 border-[#863bff] border-[3px] ${
                          c === 'tl' ? 'top-0 left-0 border-r-0 border-b-0 rounded-tl' :
                          c === 'tr' ? 'top-0 right-0 border-l-0 border-b-0 rounded-tr' :
                          c === 'bl' ? 'bottom-0 left-0 border-r-0 border-t-0 rounded-bl' :
                                       'bottom-0 right-0 border-l-0 border-t-0 rounded-br'
                        }`} />
                      ))}
                      <div className="absolute left-2 right-2 h-0.5 bg-[#863bff]/80 animate-scan-line" />
                    </div>
                  </div>
                )}

                {!scannerReady && !scannerError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Camera size={32} className="text-white/60 animate-pulse" />
                  </div>
                )}

                {scannerError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                    <p className="text-white text-sm text-center leading-relaxed">{scannerError}</p>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-white/40 text-center py-2 px-3">
                Apunta al código de barras · toca <CameraOff size={11} className="inline mb-0.5" /> para cerrar
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              {...register('descripcion')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#072B5A]/20 focus:border-[#072B5A] resize-none"
              placeholder="Descripción opcional del producto"
            />
          </div>
        </div>

        {/* ── Clasificación ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Clasificación</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Multi-select de categorías */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categorías</label>
              {(() => {
                const selected = watch('categoria_ids') ?? []
                const toggle = (id: number) => {
                  const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
                  setValue('categoria_ids', next, { shouldDirty: true })
                }
                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* chips seleccionados */}
                    {selected.length > 0 && (
                      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 bg-[#F4F7FA]">
                        {selected.map(id => {
                          const cat = cats?.find(c => c.id === id)
                          return cat ? (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0E78D8]/10 text-[#0E78D8] border border-[#0E78D8]/20">
                              {cat.nombre}
                              <button type="button" onClick={() => toggle(id)} className="hover:text-red-500 transition-colors leading-none">&times;</button>
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    {/* lista de opciones */}
                    <div className="max-h-36 overflow-y-auto">
                      {(cats ?? []).length === 0
                        ? <p className="text-xs text-gray-400 px-3 py-2">Sin categorías disponibles</p>
                        : (cats ?? []).map(c => (
                            <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#F4F7FA] transition-colors">
                              <input
                                type="checkbox"
                                checked={selected.includes(c.id)}
                                onChange={() => toggle(c.id)}
                                className="accent-[#0E78D8] w-3.5 h-3.5 rounded"
                              />
                              <span className="text-sm text-[#072B5A]">{c.nombre}</span>
                            </label>
                          ))
                      }
                    </div>
                  </div>
                )
              })()}
            </div>

            <Select label="Marca"     options={marcas?.map(m => ({ value: m.id, label: m.nombre })) ?? []} placeholder="Sin marca" {...register('marca_id')} />
            <Select label="Unidad de medida" options={unidades?.map(u => ({ value: u.id, label: `${u.nombre} (${u.abreviatura})` })) ?? []} placeholder="Sin unidad" {...register('unidad_medida_id')} />
          </div>
        </div>

        {/* ── Precios ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Precios y costos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Costo *"          type="number" step="0.01" error={errors.costo?.message} {...register('costo')} />
            <Input label="Precio de venta *" type="number" step="0.01" error={errors.precio_venta?.message} {...register('precio_venta')} />
            <div>
              <Input label="ISV (%)" type="number" step="0.01" min="0" max="100" placeholder="default empresa" {...register('tasa_isv')} />
              <p className="mt-0.5 text-[10px] text-[#5F6B7A]">Vacío = usa ISV de la empresa</p>
            </div>
            <Input label="Stock mínimo" type="number" step="0.01" {...register('stock_minimo')} />
          </div>
        </div>

        {/* ── Medidas físicas ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Medidas físicas <span className="normal-case font-normal text-gray-400">(opcional)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Talla / Tamaño" placeholder="S, M, L, XL, 42…" {...register('tamaño')} />
            <Input label="Peso (kg)" type="number" step="0.001" placeholder="0.500" {...register('peso')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Largo (cm)" type="number" step="0.01" placeholder="0.00" {...register('largo')} />
            <Input label="Ancho (cm)" type="number" step="0.01" placeholder="0.00" {...register('ancho')} />
            <Input label="Alto (cm)"  type="number" step="0.01" placeholder="0.00" {...register('alto')} />
          </div>
        </div>

        {/* ── Opciones ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Opciones de rastreo</p>

          {/* Tipo */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Tipo de producto</p>
            <div className="flex gap-3">
              {([
                { value: 'venta',       label: 'Para venta',  desc: 'Aparece en el punto de venta' },
                { value: 'ingrediente', label: 'Ingrediente', desc: 'Solo se usa en recetas'        },
              ] as const).map(opt => (
                <label key={opt.value}
                  className={`flex-1 flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    watch('tipo') === opt.value
                      ? 'border-[#0E78D8] bg-[#0E78D8]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" value={opt.value} {...register('tipo')} className="mt-0.5 accent-[#0E78D8]" />
                  <div>
                    <p className="text-sm font-semibold text-[#072B5A]">{opt.label}</p>
                    <p className="text-xs text-[#5F6B7A]">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            {([
              ['maneja_lote',        'Maneja lote'],
              ['maneja_vencimiento', 'Maneja vencimiento'],
              ['maneja_serie',       'Maneja serie'],
            ] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
                <input type="checkbox" {...register(k)} className="rounded accent-[#0E78D8]" />
                {l}
              </label>
            ))}
          </div>
          <div className="pt-1 border-t border-gray-50">
            <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
              <input type="checkbox" {...register('activo')} className="rounded accent-[#0E78D8]" />
              Producto activo
            </label>
          </div>
        </div>

        {/* Botones al final (útil en móvil) */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/productos')}>Cancelar</Button>
          <Button type="submit" loading={saving}>
            {saving ? (uploadingImg ? 'Subiendo imagen…' : 'Guardando…') : (isEdit ? 'Guardar cambios' : 'Crear producto')}
          </Button>
        </div>

      </form>
    </div>
  )
}
