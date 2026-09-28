import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PenTool, Stamp, Upload, Trash2, ImageOff, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { empresaApi } from '@/api/recursos'
import { getAxiosError } from '@/lib/utils'

type Tipo = 'firma' | 'sello'

/**
 * Firma y sello de la empresa. Se guardan en la base de datos (sin URL pública)
 * y solo se imprimen en documentos autorizados con PIN.
 */
export default function FirmaSelloSection({ empresaId }: { empresaId: number }) {
  const qc = useQueryClient()
  const [error, setError] = useState<Partial<Record<Tipo, string>>>({})

  const { data } = useQuery({
    queryKey: ['empresa-firma-sello', empresaId],
    queryFn:  () => empresaApi.firmaSello(empresaId).then(r => r.data.data),
    enabled:  empresaId > 0,
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['empresa-firma-sello', empresaId] })
    qc.invalidateQueries({ queryKey: ['empresa', empresaId] })
  }

  const subir = useMutation({
    mutationFn: ({ tipo, file }: { tipo: Tipo; file: File }) => empresaApi.uploadFirmaSello(empresaId, tipo, file),
    onSuccess: (_, { tipo }) => { setError(e => ({ ...e, [tipo]: '' })); refrescar() },
    onError: (err, { tipo }) => setError(e => ({ ...e, [tipo]: getAxiosError(err) })),
  })

  const eliminar = useMutation({
    mutationFn: (tipo: Tipo) => empresaApi.deleteFirmaSello(empresaId, tipo),
    onSuccess: (_, tipo) => { setError(e => ({ ...e, [tipo]: '' })); refrescar() },
    onError: (err, tipo) => setError(e => ({ ...e, [tipo]: getAxiosError(err) })),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-bold text-[var(--cs)] mb-1 flex items-center gap-2">
        <ShieldCheck size={16} className="text-[var(--cp)]" /> Firma y sello
      </h2>
      <p className="text-xs text-[#5F6B7A] mb-5">
        Solo aparecen en requisiciones y cotizaciones autorizadas con PIN por un usuario con el permiso
        "Autorizar documentos". Usa imágenes PNG con fondo transparente para mejor resultado.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Imagen tipo="firma" titulo="Firma autorizada" icono={<PenTool size={14} />}
          src={data?.firma ?? null} error={error.firma}
          subiendo={subir.isPending && subir.variables?.tipo === 'firma'}
          eliminando={eliminar.isPending && eliminar.variables === 'firma'}
          onSubir={file => subir.mutate({ tipo: 'firma', file })}
          onEliminar={() => eliminar.mutate('firma')} />
        <Imagen tipo="sello" titulo="Sello de la empresa" icono={<Stamp size={14} />}
          src={data?.sello ?? null} error={error.sello}
          subiendo={subir.isPending && subir.variables?.tipo === 'sello'}
          eliminando={eliminar.isPending && eliminar.variables === 'sello'}
          onSubir={file => subir.mutate({ tipo: 'sello', file })}
          onEliminar={() => eliminar.mutate('sello')} />
      </div>
    </div>
  )
}

interface ImagenProps {
  tipo: Tipo
  titulo: string
  icono: React.ReactNode
  src: string | null
  error?: string
  subiendo: boolean
  eliminando: boolean
  onSubir: (file: File) => void
  onEliminar: () => void
}

function Imagen({ tipo, titulo, icono, src, error, subiendo, eliminando, onSubir, onEliminar }: ImagenProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">{icono} {titulo}</p>
      <div className="h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden mb-3">
        {src
          ? <img src={src} alt={titulo} className="max-h-full max-w-full object-contain p-2" />
          : <ImageOff size={26} className="text-gray-300" />}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSubir(f); e.target.value = '' }} />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" icon={<Upload size={14} />} loading={subiendo} onClick={() => ref.current?.click()}>
          {src ? 'Cambiar' : `Subir ${tipo}`}
        </Button>
        {src && (
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} loading={eliminando} onClick={onEliminar}>
            Eliminar
          </Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">PNG, JPG o WEBP · Máximo 1 MB</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
