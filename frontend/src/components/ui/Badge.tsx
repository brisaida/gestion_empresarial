import { cn } from '@/lib/utils'

type Variant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'indigo'

const variants: Record<Variant, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red:    'bg-red-50 text-red-700 ring-red-600/20',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue:   'bg-blue-50 text-blue-700 ring-blue-600/20',
  gray:   'bg-gray-100 text-gray-600 ring-gray-500/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'gray', children, className }: Props) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', variants[variant], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ activo }: { activo: boolean }) {
  return <Badge variant={activo ? 'green' : 'red'}>{activo ? 'Activo' : 'Inactivo'}</Badge>
}
