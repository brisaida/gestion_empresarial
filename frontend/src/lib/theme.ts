function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export function applyTheme(primary = '#0E78D8', secondary = '#072B5A') {
  const root = document.documentElement
  const pRgb = hexToRgb(primary)
  const sRgb = hexToRgb(secondary)

  root.style.setProperty('--cp',     primary)
  root.style.setProperty('--cs',     secondary)

  // Variantes con opacidad pre-calculadas para uso en inline styles
  root.style.setProperty('--cp-5',   `rgba(${pRgb}, 0.05)`)
  root.style.setProperty('--cp-8',   `rgba(${pRgb}, 0.08)`)
  root.style.setProperty('--cp-10',  `rgba(${pRgb}, 0.10)`)
  root.style.setProperty('--cp-15',  `rgba(${pRgb}, 0.15)`)
  root.style.setProperty('--cp-20',  `rgba(${pRgb}, 0.20)`)
  root.style.setProperty('--cp-30',  `rgba(${pRgb}, 0.30)`)
  root.style.setProperty('--cs-8',   `rgba(${sRgb}, 0.08)`)
  root.style.setProperty('--cs-30',  `rgba(${sRgb}, 0.30)`)
}
