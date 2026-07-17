import { ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Todos',
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="field multi-select" ref={ref}>
      <label>{label}</label>
      <button type="button" className="select-trigger" onClick={() => setOpen(!open)}>
        <span>{value.length ? `${value.length} seleccionado${value.length > 1 ? 's' : ''}` : placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {value.length > 0 && (
        <div className="chips">
          {value.slice(0, 2).map((item) => (
            <span className="chip" key={item}>{item}<X size={12} onClick={() => onChange(value.filter((v) => v !== item))} /></span>
          ))}
          {value.length > 2 && <span className="chip muted">+{value.length - 2}</span>}
        </div>
      )}
      {open && (
        <div className="select-menu">
          <button className="menu-action" onClick={() => onChange([])}>Todos</button>
          {options.map((option) => (
            <label className="check-row" key={option}>
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
