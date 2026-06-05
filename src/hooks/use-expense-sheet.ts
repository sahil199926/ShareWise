import { useEffect, useState } from 'react'
import { getExpenseSheet } from '../services/expense-sheet.service'
import type { ExpenseSheetData } from '../types/expense-sheet'

export const useExpenseSheet = (sheetId: string, requesterEmail: string) => {
  const [data, setData] = useState<ExpenseSheetData | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getExpenseSheet(sheetId, requesterEmail)
      .then((sheet) => {
        if (cancelled) return

        setData(sheet)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return

        setError(err instanceof Error ? err.message : 'Failed to load sheet')
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sheetId, requesterEmail])

  return { data, error, isLoading }
}
