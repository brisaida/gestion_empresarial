import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => remove(id), 4500)
  }, [remove])

  const value: ToastContextValue = {
    success: (msg) => add('success', msg),
    error:   (msg) => add('error',   msg),
    warning: (msg) => add('warning', msg),
    info:    (msg) => add('info',    msg),
  }

  const cfg: Record<ToastType, { bar: string; icon: ReactNode }> = {
    success: { bar: 'bg-emerald-500', icon: <CheckCircle2 size={17} className="text-emerald-500 shrink-0" /> },
    error:   { bar: 'bg-red-500',     icon: <XCircle      size={17} className="text-red-500 shrink-0" /> },
    warning: { bar: 'bg-amber-500',   icon: <AlertTriangle size={17} className="text-amber-500 shrink-0" /> },
    info:    { bar: 'bg-[#0E78D8]',   icon: <Info          size={17} className="text-[#0E78D8] shrink-0" /> },
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="relative overflow-hidden flex items-start gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-200 shadow-xl text-sm pointer-events-auto animate-toast-in"
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg[t.type].bar} rounded-l-xl`} />
            <div className="ml-1">{cfg[t.type].icon}</div>
            <p className="flex-1 text-gray-800 font-medium leading-snug whitespace-pre-line">{t.message}</p>
            <button onClick={() => remove(t.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
