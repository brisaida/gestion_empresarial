import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
  padding?: boolean
}

export default function Card({ children, className, padding = true }: Props) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 shadow-sm', padding && 'p-6', className)}>
      {children}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  color?: 'electric' | 'cyan' | 'emerald' | 'amber' | 'red' | 'indigo'
  trend?: { value: string; up: boolean }
}

const colors = {
  electric: { bg: 'bg-[var(--cp)]/8',  icon: 'bg-[var(--cp)]/15 text-[var(--cp)]', border: 'border-[var(--cp)]/20' },
  cyan:     { bg: 'bg-[var(--cs)]/8',  icon: 'bg-[var(--cs)]/15 text-[var(--cs)]', border: 'border-[var(--cs)]/20' },
  indigo:   { bg: 'bg-[var(--cp)]/8',  icon: 'bg-[var(--cp)]/15 text-[var(--cp)]', border: 'border-[var(--cp)]/20' },
  emerald:  { bg: 'bg-emerald-50',   icon: 'bg-emerald-100 text-emerald-600',  border: 'border-emerald-100' },
  amber:    { bg: 'bg-amber-50',     icon: 'bg-amber-100 text-amber-600',      border: 'border-amber-100' },
  red:      { bg: 'bg-red-50',       icon: 'bg-red-100 text-red-600',          border: 'border-red-100' },
}

export function MetricCard({ title, value, subtitle, icon, color = 'electric', trend }: MetricCardProps) {
  const c = colors[color]
  return (
    <div className={cn('rounded-xl border shadow-sm p-5 flex items-start gap-4', c.bg, c.border)}>
      <div className={cn('rounded-xl p-3 shrink-0', c.icon)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#5F6B7A] uppercase tracking-wider truncate">{title}</p>
        <p className="text-2xl font-bold text-[var(--cs)] mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={cn('text-xs font-medium mt-1', trend.up ? 'text-emerald-600' : 'text-red-500')}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  )
}
