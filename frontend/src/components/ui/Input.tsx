import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">{label}</label>}
    <input
      ref={ref}
      {...props}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all duration-150',
        error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-[#0E78D8]/50',
        props.disabled && 'bg-gray-50 cursor-not-allowed',
        className,
      )}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
))
Input.displayName = 'Input'
export default Input
