import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  placeholder?: string
  options: { value: string | number; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, Props>(({ label, error, placeholder, options, className, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">{label}</label>}
    <select
      ref={ref}
      {...props}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all duration-150',
        error ? 'border-red-400' : 'border-gray-200 hover:border-[#0E78D8]/50',
        className,
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
))
Select.displayName = 'Select'
export default Select
