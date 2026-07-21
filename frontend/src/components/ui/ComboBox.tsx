import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboOption {
  value: string | number
  label: string
}

interface Props {
  value?: string | number | null
  onChange: (value: string) => void
  options: ComboOption[]
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
}

export default function ComboBox({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  label,
  error,
  disabled,
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)
  const dropdownRef         = useRef<HTMLDivElement>(null)

  const selected = options.find(o => String(o.value) === String(value ?? ''))
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // focus search when opened, flip upward if near bottom
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    if (containerRef.current && dropdownRef.current) {
      const rect      = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropH     = dropdownRef.current.offsetHeight || 220
      if (spaceBelow < dropH + 8) {
        dropdownRef.current.style.bottom = `${rect.height + 4}px`
        dropdownRef.current.style.top    = 'auto'
      } else {
        dropdownRef.current.style.top    = `${rect.height + 4}px`
        dropdownRef.current.style.bottom = 'auto'
      }
    }
  }, [open])

  const select = (opt: ComboOption) => {
    onChange(String(opt.value))
    setOpen(false)
    setSearch('')
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setSearch('')
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">
          {label}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(v => !v)}
          className={cn(
            'w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm bg-white text-left gap-2',
            'focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all duration-150',
            error ? 'border-red-400' : 'border-gray-200 hover:border-[#0E78D8]/50',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
            triggerClassName,
          )}
        >
          <span className={cn('flex-1 truncate', selected ? 'text-[#072B5A]' : 'text-gray-400')}>
            {selected?.label ?? placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {selected && !disabled && (
              <span
                role="button"
                onClick={clear}
                className="p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={12} />
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
            />
          </span>
        </button>

        {open && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-[#F4F7FA] rounded-md">
                <Search size={13} className="text-gray-400 shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setOpen(false); setSearch('') }
                    if (e.key === 'Enter' && filtered.length === 1) select(filtered[0])
                  }}
                  placeholder="Buscar…"
                  className="flex-1 bg-transparent text-sm text-[#072B5A] placeholder-gray-400 outline-none min-w-0"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 px-3 py-4 text-center">Sin resultados</p>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => select(o)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      String(o.value) === String(value ?? '')
                        ? 'bg-[#0E78D8] text-white font-medium'
                        : 'text-[#072B5A] hover:bg-[#F4F7FA]',
                    )}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
