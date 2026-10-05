import { useEffect, useState } from 'react'

interface Props {
  value: number
  onChange: (cantidad: number) => void
  /** Se llama cuando el campo queda vacío o en 0 al salir de él */
  onRemove: () => void
  className?: string
}

/**
 * Input de cantidad que permite borrar el número mientras se escribe.
 * Si al salir del campo queda vacío o en 0, la línea se elimina.
 */
export default function CantidadInput({ value, onChange, onRemove, className }: Props) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(prev => (Number(prev) === value ? prev : String(value)))
  }, [value])

  return (
    <input
      type="number" min="0" step="1" inputMode="decimal"
      value={draft}
      onChange={e => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && n > 0) onChange(n)
      }}
      onBlur={() => {
        if (draft === '' || !(Number(draft) > 0)) onRemove()
        else setDraft(String(value))
      }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      onFocus={e => e.currentTarget.select()}
      className={className}
    />
  )
}
