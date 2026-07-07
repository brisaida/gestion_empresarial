import { useEffect, useRef } from 'react'

const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const

export function useIdleLogout(onLogout: () => void, minutes = 15) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(onLogout, minutes * 60 * 1000)
    }

    reset()
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timer.current) clearTimeout(timer.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [onLogout, minutes])
}
