import { useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, X, ScanBarcode, Camera, CameraOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { productosApi, categoriasApi, marcasApi, unidadesApi, bodegasApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'
import { BrowserMultiFormatReader } from '@zxing/browser'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ComboBox from '@/components/ui/ComboBox'
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
  precio_incluye_isv: z.boolean().default(false),
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
  stock_inicial:      z.coerce.number().min(0).default(0),
  bodega_id:          z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ProductoFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { state } = useAuth()
  const empresaId: number = state.empresaActiva?.id ?? 0
  const esRestaurante = state.empresaActiva?.rubro === 'restaurante'

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [medidasOpen, setMedidasOpen]   = useState(false)

  const [scannerOpen, setScannerOpen]   = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [scannerReady, setScannerReady] = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  const [apiError, setApiError] = useState('')

  const { data: cats }     = useQuery({ queryKey: ['categorias', empresaId],      queryFn: () => categoriasApi.list({ empresa_id: empresaId, per_page: 100, solo_activos: true }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: marcas }   = useQuery({ queryKey: ['marcas', empresaId],           queryFn: () => marcasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: unidades } = useQuery({ queryKey: ['unidades-medida', empresaId],  queryFn: () => unidadesApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 })
  const { data: bodegas }  = useQuery({ queryKey: ['bodegas', empresaId],          queryFn: () => bodegasApi.list({ empresa_id: empresaId, per_page: 100 }).then(r => r.data.data), enabled: empresaId > 0 && !isEdit })

  const { data: producto, isLoading: loadingProducto } = useQuery({
    queryKey: ['producto', id],
    queryFn:  () => productosApi.get(Number(id)).then(r => r.data.data as Producto),
    enabled:  isEdit,
  })

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
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
        precio_incluye_isv: producto.precio_incluye_isv ?? false,
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
    bodega_id:        v.bodega_id ? Number(v.bodega_id) : null,
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

  // ── Barcode scanner ──────────────────────────────────────────────────────
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
      reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result) => {
        if (result && !scannedRef.current) {
          scannedRef.current = true
          const code = result.getText()
          stopTracks()
          const doneReader = readerRef.current
          readerRef.current = null
          try { doneReader?.reset() } catch { /* ignore */ }
          flushSync(() => { setScannerOpen(false); setScannerReady(false) })
          setValue('codigo_barra', code, { shouldValidate: true })
        }
      }).catch(() => { if (!scannedRef.current) setScannerError('Error al acceder a la cámara.') })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/permission|notallowed/i.test(msg)) setScannerError('Permiso de cámara denegado. Actívalo en la configuración del navegador.')
      else setScannerError('No se pudo acceder a la cámara.')
    }
  }, [setValue, stopTracks])

  useEffect(() => () => { stopScanner() }, [stopScanner])

  if (isEdit && loadingProducto) {
    return <div className="flex items-center justify-center h-48 text-[#5F6B7A] text-sm">Cargando producto…</div>
  }

  const saving = isSubmitting || uploadingImg

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/productos')}
            className="p-2 rounded-lg text-[#5F6B7A] hover:text-[var(--cs)] hover:bg-white border border-transparent hover:border-gray-200 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--cs)]">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
            <p className="text-sm text-[#5F6B7A]">{isEdit ? producto?.nombre : 'Completa la información del producto'}</p>
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{apiError}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ══ COLUMNA PRINCIPAL (2/3) ══════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Información básica */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Información básica</p>

              <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />

              <div className="grid grid-cols-2 gap-4">
                <Input label="Código interno" placeholder="P-001" {...register('codigo')} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Código de barras</label>
                  <div className="flex gap-1.5">
                    <input
                      {...register('codigo_barra')}
                      className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--cs)]/20 focus:border-[var(--cs)]"
                      placeholder="Escribe o escanea"
                    />
                    <button
                      type="button"
                      onClick={scannerOpen ? stopScanner : startScanner}
                      className={`p-2 rounded-lg border transition-colors ${scannerOpen ? 'border-[var(--cs)] bg-[var(--cs)] text-white' : 'border-gray-200 text-gray-500 hover:text-[var(--cs)] hover:border-[var(--cs)] hover:bg-blue-50'}`}
                      title={scannerOpen ? 'Cerrar escáner' : 'Escanear con cámara'}
                    >
                      {scannerOpen ? <CameraOff size={18} /> : <ScanBarcode size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {scannerOpen && (
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                  <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    {scannerReady && !scannerError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-3/4 h-24">
                          {(['tl','tr','bl','br'] as const).map(c => (
                            <span key={c} className={`absolute w-6 h-6 border-[#863bff] border-[3px] ${c === 'tl' ? 'top-0 left-0 border-r-0 border-b-0 rounded-tl' : c === 'tr' ? 'top-0 right-0 border-l-0 border-b-0 rounded-tr' : c === 'bl' ? 'bottom-0 left-0 border-r-0 border-t-0 rounded-bl' : 'bottom-0 right-0 border-l-0 border-t-0 rounded-br'}`} />
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
                        <p className="text-white text-sm text-center">{scannerError}</p>
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
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--cs)]/20 focus:border-[var(--cs)] resize-none"
                  placeholder="Descripción opcional del producto"
                />
              </div>
            </div>

            {/* Precios y costos */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Precios y costos</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Costo *"           type="number" step="0.01" error={errors.costo?.message}        {...register('costo')} />
                <Input label="Precio de venta *" type="number" step="0.01" error={errors.precio_venta?.message} {...register('precio_venta')} />
                <div>
                  <Input label="ISV (%)" type="number" step="0.01" min="0" max="100" placeholder="default empresa" {...register('tasa_isv')} />
                  <p className="mt-0.5 text-[10px] text-[#5F6B7A]">Vacío = usa el ISV de la empresa</p>
                </div>
                <Input label="Stock mínimo" type="number" step="0.01" {...register('stock_minimo')} />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" {...register('precio_incluye_isv')} className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[var(--cp)] cursor-pointer shrink-0" />
                <div>
                  <span className="text-sm font-medium text-[var(--cs)]">El precio de venta ya incluye ISV</span>
                  <p className="text-[11px] text-[#5F6B7A] mt-0.5">Al vender o cotizar, el ISV se extrae del precio en lugar de sumarse encima.</p>
                </div>
              </label>
            </div>

            {/* Stock inicial (solo al crear) */}
            {!isEdit && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Stock inicial</p>
                  <p className="text-xs text-[#5F6B7A] mt-0.5">Opcional — puedes registrar las unidades disponibles al crear el producto.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Cantidad inicial" type="number" step="0.01" min="0" placeholder="0" {...register('stock_inicial')} />
                  <Controller
                    name="bodega_id"
                    control={control}
                    render={({ field }) => (
                      <ComboBox
                        label="Bodega"
                        options={[
                          { value: '', label: 'Sin asignar' },
                          ...(bodegas?.map(b => ({ value: b.id, label: b.predeterminada ? `${b.nombre} (predeterminada)` : b.nombre })) ?? []),
                        ]}
                        placeholder="Sin asignar"
                        value={field.value ?? ''}
                        onChange={v => field.onChange(v)}
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {/* Medidas físicas (colapsable) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setMedidasOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
              >
                <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">
                  Medidas físicas <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </p>
                {medidasOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>
              {medidasOpen && (
                <div className="px-5 pb-5 space-y-3 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Input label="Talla / Tamaño" placeholder="S, M, L, XL, 42…" {...register('tamaño')} />
                    <Input label="Peso (kg)" type="number" step="0.001" placeholder="0.500" {...register('peso')} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Largo (cm)" type="number" step="0.01" placeholder="0.00" {...register('largo')} />
                    <Input label="Ancho (cm)" type="number" step="0.01" placeholder="0.00" {...register('ancho')} />
                    <Input label="Alto (cm)"  type="number" step="0.01" placeholder="0.00" {...register('alto')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══ SIDEBAR (1/3) ════════════════════════════════════════════ */}
          <div className="space-y-5">

            {/* Imagen */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide mb-4">Foto del producto</p>
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" className="w-36 h-36 rounded-xl object-cover border border-gray-200 shadow-sm" />
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
                    <div className="w-36 h-36 rounded-xl bg-[#F4F7FA] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                      <ImagePlus size={28} className="text-gray-300" />
                      <span className="text-[11px] text-gray-300 font-medium">Sin foto</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" id="imagen-input"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImageFile(file)
                    setImagePreview(URL.createObjectURL(file))
                  }}
                />
                <label htmlFor="imagen-input" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-[#5F6B7A] hover:border-[var(--cp)] hover:text-[var(--cp)] cursor-pointer transition-all w-full justify-center">
                  <ImagePlus size={13} />
                  {imagePreview ? 'Cambiar foto' : 'Subir foto'}
                </label>
                <p className="text-[10px] text-gray-400">JPG, PNG o WebP · Máx. 2 MB</p>
              </div>
            </div>

            {/* Clasificación */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Clasificación</p>

              <Controller
                name="marca_id"
                control={control}
                render={({ field }) => (
                  <ComboBox
                    label="Marca"
                    options={marcas?.map(m => ({ value: m.id, label: m.nombre })) ?? []}
                    placeholder="Sin marca"
                    value={field.value ?? ''}
                    onChange={v => field.onChange(v)}
                  />
                )}
              />

              <Controller
                name="unidad_medida_id"
                control={control}
                render={({ field }) => (
                  <ComboBox
                    label="Unidad de medida"
                    options={unidades?.map(u => ({ value: u.id, label: `${u.nombre} (${u.abreviatura})` })) ?? []}
                    placeholder="Sin unidad"
                    value={field.value ?? ''}
                    onChange={v => field.onChange(v)}
                  />
                )}
              />

              {/* Categorías */}
              <div>
                <label className="block text-xs font-semibold text-[var(--cs)] uppercase tracking-wide mb-2">Categorías</label>
                {(() => {
                  const selected = watch('categoria_ids') ?? []
                  const toggle = (cid: number) => {
                    const next = selected.includes(cid) ? selected.filter(x => x !== cid) : [...selected, cid]
                    setValue('categoria_ids', next, { shouldDirty: true })
                  }
                  return (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {selected.length > 0 && (
                        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 bg-[#F4F7FA]">
                          {selected.map(cid => {
                            const cat = cats?.find(c => c.id === cid)
                            return cat ? (
                              <span key={cid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--cp)]/10 text-[var(--cp)] border border-[var(--cp)]/20">
                                {cat.nombre}
                                <button type="button" onClick={() => toggle(cid)} className="hover:text-red-500 leading-none">&times;</button>
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                      <div className="max-h-40 overflow-y-auto">
                        {(cats ?? []).length === 0
                          ? <p className="text-xs text-gray-400 px-3 py-2">Sin categorías disponibles</p>
                          : (cats ?? []).map(c => (
                              <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#F4F7FA] transition-colors">
                                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="accent-[var(--cp)] w-3.5 h-3.5 rounded" />
                                <span className="text-sm text-[var(--cs)]">{c.nombre}</span>
                              </label>
                            ))
                        }
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Estado y opciones */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-[var(--cs)] uppercase tracking-wide">Estado y opciones</p>

              {esRestaurante && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tipo de producto</p>
                  <div className="space-y-2">
                    {([
                      { value: 'venta',       label: 'Para venta',  desc: 'Aparece en el punto de venta' },
                      { value: 'ingrediente', label: 'Ingrediente', desc: 'Solo se usa en recetas'        },
                    ] as const).map(opt => (
                      <label key={opt.value} className={`flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${watch('tipo') === opt.value ? 'border-[var(--cp)] bg-[var(--cp)]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" value={opt.value} {...register('tipo')} className="mt-0.5 accent-[var(--cp)]" />
                        <div>
                          <p className="text-sm font-semibold text-[var(--cs)]">{opt.label}</p>
                          <p className="text-xs text-[#5F6B7A]">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
                  <input type="checkbox" {...register('maneja_vencimiento')} className="rounded accent-[var(--cp)]" />
                  Maneja vencimiento
                </label>
                <label className="flex items-center gap-2 text-sm text-[#5F6B7A] cursor-pointer">
                  <input type="checkbox" {...register('activo')} className="rounded accent-[var(--cp)]" />
                  Producto activo
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Botones al final (móvil) */}
        <div className="flex justify-end gap-2 pt-5">
          <Button type="button" variant="secondary" onClick={() => navigate('/productos')}>Cancelar</Button>
          <Button type="submit" loading={saving}>
            {saving ? (uploadingImg ? 'Subiendo imagen…' : 'Guardando…') : (isEdit ? 'Guardar cambios' : 'Crear producto')}
          </Button>
        </div>
      </form>
    </div>
  )
}
