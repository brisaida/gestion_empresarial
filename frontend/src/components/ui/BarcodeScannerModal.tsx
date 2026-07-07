import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, Camera, AlertCircle } from 'lucide-react'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScannerModal({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        // Preferir cámara trasera en móviles
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[0]
        if (!back) { setError('No se encontró ninguna cámara.'); return }

        setScanning(true)
        await reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result, err) => {
          if (result) {
            onScan(result.getText())
            onClose()
          }
          if (err && !err.message?.includes('No MultiFormat Readers')) {
            console.warn('Scanner:', err)
          }
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('Permission') || msg.includes('permission') || msg.includes('NotAllowed')) {
          setError('Permiso de cámara denegado. Actívalo en la configuración del navegador.')
        } else {
          setError('No se pudo acceder a la cámara.')
        }
      }
    }

    start()

    return () => { readerRef.current?.reset() }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-sm bg-black rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#072B5A]">
          <div className="flex items-center gap-2 text-white">
            <Camera size={18} />
            <span className="text-sm font-semibold">Escanear código de barras</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Visor */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" />

          {/* Marco de escaneo */}
          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-36">
                {/* Esquinas */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                  <span key={pos} className={`absolute w-6 h-6 border-[#863bff] border-[3px] ${
                    pos === 'top-left'     ? 'top-0 left-0 border-r-0 border-b-0 rounded-tl-md' :
                    pos === 'top-right'    ? 'top-0 right-0 border-l-0 border-b-0 rounded-tr-md' :
                    pos === 'bottom-left'  ? 'bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md' :
                                            'bottom-0 right-0 border-l-0 border-t-0 rounded-br-md'
                  }`} />
                ))}
                {/* Línea de escaneo animada */}
                <div className="absolute left-2 right-2 h-0.5 bg-[#863bff]/80 animate-scan-line" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 bg-black/90">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-white text-sm text-center leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <p className="text-white/50 text-xs text-center py-3 px-4">
          Apunta la cámara al código de barras del producto
        </p>
      </div>
    </div>
  )
}
