import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = {
  value: string
  label: string
}

type SelectFieldProps = {
  id?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  ariaLabel?: string
  className?: string
}

type MenuBox = {
  top: number
  left: number
  width: number
  maxHeight: number
  openUp: boolean
}

const SelectField = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
  required = false,
  ariaLabel,
  className = 'mt-1 w-full',
}: SelectFieldProps) => {
  const generatedId = useId()
  const listId = `${id ?? generatedId}-list`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [box, setBox] = useState<MenuBox | null>(null)
  const selected = options.find((option) => option.value === value)

  const placeMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow

    setBox({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(140, Math.min(280, openUp ? spaceAbove : spaceBelow)),
      openUp,
    })
  }

  useEffect(() => {
    if (!isOpen) return

    placeMenu()

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    const onReflow = () => placeMenu()

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [isOpen])

  const choose = (next: string) => {
    onChange(next)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          value={value}
          required
          onChange={() => undefined}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      ) : null}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald/15 bg-white/80 px-3 py-2.5 text-left text-sm shadow-sm outline-none backdrop-blur-md transition hover:border-emerald/30 focus:border-emerald-light focus:ring-2 focus:ring-emerald-light/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`truncate ${selected ? 'text-high' : 'text-low'}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`size-4 shrink-0 text-emerald-deep transition ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && box
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              style={{
                position: 'fixed',
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
                transform: box.openUp ? 'translateY(-100%)' : undefined,
              }}
              className="z-[80] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl"
            >
              {options.map((option) => {
                const isSelected = option.value === value

                return (
                  <li key={option.value || option.label} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(option.value)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? 'bg-emerald/15 font-semibold text-emerald-deep'
                          : 'text-high hover:bg-emerald/8'
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className="size-4 shrink-0"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 111.4-1.4l4.1 4.1 6.5-6.5a1 1 0 011.4 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}

export default SelectField
