import { useEffect, useState } from 'react'
import { getSharedExpenseSheet } from '../services/expense-sheet.service'
import type { ExpenseSheetData } from '../types/expense-sheet'

export const useSharedExpenseSheet = (sheetId: string) => {
  const [data, setData] = useState<ExpenseSheetData | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getSharedExpenseSheet(sheetId)
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
  }, [sheetId])

  return { data, error, isLoading }
}
