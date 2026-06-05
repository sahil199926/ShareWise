import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { formatPaidBy } from '../../lib/expense-sheet-utils'

type PaidByMultiSelectProps = {
  users: string[]
  value: string[]
  onChange: (next: string[]) => void
}

const PaidByMultiSelect = ({
  users,
  value,
  onChange,
}: PaidByMultiSelectProps) => {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const updateMenuPosition = () => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()

    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 168),
      zIndex: 60,
    })
  }

  useEffect(() => {
    if (!open) return

    updateMenuPosition()

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !rootRef.current?.contains(target) &&
        !(target as Element).closest?.('.paid-by-menu')
      ) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open])

  const togglePayer = (userName: string) => {
    if (value.includes(userName)) {
      onChange(value.filter((payer) => payer !== userName))
      return
    }

    onChange([...value, userName])
  }

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="paid-by-menu rounded-xl border border-divider bg-surface p-2 shadow-lg"
            style={menuStyle}
          >
            {users.map((user) => (
              <label
                key={user}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-medium hover:bg-surface-elevated"
              >
                <input
                  type="checkbox"
                  checked={value.includes(user)}
                  onChange={() => togglePayer(user)}
                  className="rounded border-divider text-emerald focus:ring-emerald-light/30"
                />
                <span>{user}</span>
              </label>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="min-w-32">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="expense-cell-input-left w-full"
      >
        {value.length ? formatPaidBy(value) : '—'}
      </button>
      {menu}
    </div>
  )
}

export default PaidByMultiSelect
