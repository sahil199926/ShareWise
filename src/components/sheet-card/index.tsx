import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCanHover } from '../../hooks/use-can-hover'
import { getEditSheetPath, getShareSheetPath } from '../../lib/sheet-urls'
import type { SheetItem } from '../../types/sheet'

type SheetCardProps = {
  sheet: SheetItem
}

const SheetCard = ({ sheet }: SheetCardProps) => {
  const canHover = useCanHover()
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (canHover || !isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [canHover, isExpanded])

  const handleCardClick = () => {
    if (!canHover) {
      setIsExpanded((open) => !open)
    }
  }

  const handleActionClick = () => {
    if (!canHover) {
      setIsExpanded(false)
    }
  }

  return (
    <article
      ref={cardRef}
      className={`sheet-card card ${isExpanded ? 'sheet-card-expanded' : ''}`}
      data-expanded={isExpanded}
      onClick={handleCardClick}
    >
      <div className="sheet-card-front">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-high">
              {sheet.name}
            </h3>
            <p className="mt-1 truncate text-xs text-low">ID: {sheet.id}</p>
          </div>
          <span className="badge-accent shrink-0">Sheet</span>
        </div>
      </div>

      <div className="sheet-card-split">
        <Link
          to={getShareSheetPath(sheet.id)}
          state={{ sheet }}
          onClick={(event) => {
            event.stopPropagation()
            handleActionClick()
          }}
          className="sheet-card-half sheet-card-share"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.225-1.224a4 4 0 00-5.657-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
            <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.225 1.224a4 4 0 105.657 5.656l3-3a4 4 0 00-.225-5.865z" />
          </svg>
          <span className="text-sm font-semibold">Share link</span>
        </Link>

        <Link
          to={getEditSheetPath(sheet.id)}
          state={{ sheet }}
          onClick={(event) => {
            event.stopPropagation()
            handleActionClick()
          }}
          className="sheet-card-half sheet-card-edit"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
          <span className="text-sm font-semibold">Edit</span>
        </Link>
      </div>
    </article>
  )
}

export default SheetCard
