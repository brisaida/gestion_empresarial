const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const DECENAS  = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

/** 0–999 en letras */
function centenas(n: number): string {
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100), r = n % 100
  let txt = CENTENAS[c]
  if (r > 0) {
    const resto = r < 30
      ? UNIDADES[r]
      : DECENAS[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNIDADES[r % 10] : '')
    txt = txt ? `${txt} ${resto}` : resto
  }
  return txt
}

function entero(n: number): string {
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1_000_000)
  const miles    = Math.floor((n % 1_000_000) / 1000)
  const resto    = n % 1000
  const partes: string[] = []
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${entero(millones)} MILLONES`)
  if (miles)    partes.push(miles === 1 ? 'MIL' : `${centenas(miles)} MIL`)
  if (resto)    partes.push(centenas(resto))
  return partes.join(' ')
}

/** 1234.5 → "MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 50/100" */
export function numeroALetras(monto: number, moneda = 'LEMPIRAS'): string {
  const total    = Math.round(Math.abs(monto) * 100)
  const lempiras = Math.floor(total / 100)
  const centavos = total % 100
  return `${entero(lempiras)} ${lempiras === 1 ? moneda.replace(/S$/, '') : moneda} CON ${String(centavos).padStart(2, '0')}/100`
}
