/** Fecha local del dispositivo en formato YYYY-MM-DD (sin conversión a UTC). */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

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

const SERVER_MESSAGES: Record<string, string> = {
  'Server Error':              'Ocurrió un error en el servidor. Por favor intenta de nuevo.',
  'Unauthenticated.':          'Tu sesión expiró. Inicia sesión nuevamente.',
  'Unauthorized':              'No tienes permiso para realizar esta acción.',
  'Too Many Requests':         'Demasiados intentos. Espera un momento e intenta de nuevo.',
  'Not Found':                 'El recurso solicitado no existe.',
  'The given data was invalid.': 'Algunos datos no son válidos. Revisa los campos marcados.',
}

const FIELD_LABELS: Record<string, string> = {
  nombre:       'Nombre',
  nombre_legal: 'Razón social',
  correo:       'Correo',
  telefono:     'Teléfono',
  direccion:    'Dirección',
  rtn:          'RTN',
  password:     'Contraseña',
  empresa_id:   'Empresa',
  bodega_id:    'Bodega',
  cantidad:     'Cantidad',
  precio_unitario: 'Precio',
}

export function getAxiosError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response: { status: number; data: { message?: string; errors?: Record<string, string[]> } } }).response
    const rawMsg = res?.data?.message ?? ''
    const fieldErrors = res?.data?.errors

    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      const lines = Object.entries(fieldErrors).map(([field, msgs]) => {
        const label = FIELD_LABELS[field] ?? field
        return `• ${label}: ${msgs[0]}`
      })
      return lines.join('\n')
    }

    if (rawMsg && SERVER_MESSAGES[rawMsg]) return SERVER_MESSAGES[rawMsg]
    if (rawMsg) return rawMsg

    const status = res?.status
    if (status === 500) return 'Error en el servidor. Por favor intenta de nuevo.'
    if (status === 403) return 'No tienes permiso para realizar esta acción.'
    if (status === 404) return 'El recurso solicitado no existe.'
    if (status === 429) return 'Demasiados intentos. Espera un momento.'

    return 'Ocurrió un error inesperado.'
  }
  return 'No se pudo conectar al servidor. Verifica tu conexión.'
}
