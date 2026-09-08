import { useEffect, useRef } from 'react'

const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'] as const

interface Options {
  onLogout: () => void
  onWarn?: () => void
  minutes?: number
  /** Cuántos minutos antes del logout mostrar el aviso (default: 1) */
  warnMinutesBefore?: number
}

export function useIdleLogout({ onLogout, onWarn, minutes = 30, warnMinutesBefore = 1 }: Options) {
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warned      = useRef(false)

  useEffect(() => {
    const totalMs = minutes * 60 * 1000
    const warnMs  = (minutes - warnMinutesBefore) * 60 * 1000

    const reset = () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (warnTimer.current)   clearTimeout(warnTimer.current)
      warned.current = false

      if (onWarn) {
        warnTimer.current = setTimeout(() => {
          warned.current = true
          onWarn()
        }, warnMs)
      }

      logoutTimer.current = setTimeout(onLogout, totalMs)
    }

    reset()
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (warnTimer.current)   clearTimeout(warnTimer.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [onLogout, onWarn, minutes, warnMinutesBefore])
}
