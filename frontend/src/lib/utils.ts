export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-HN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value + 'T00:00:00').toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getAxiosError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response: { data: { message?: string } } }).response
    return res?.data?.message ?? 'Error inesperado.'
  }
  return 'Error de conexión.'
}
