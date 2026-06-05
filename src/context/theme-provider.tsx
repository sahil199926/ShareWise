import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  applyThemeToDocument,
  getStoredTheme,
  setStoredTheme,
  type ThemeMode,
} from '../lib/theme-storage'
import { ThemeContext } from './theme-context'

const getInitialTheme = (): ThemeMode => {
  return getStoredTheme() ?? 'dark'
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = getInitialTheme()
    applyThemeToDocument(initial)
    return initial
  })

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
    setStoredTheme(nextTheme)
    applyThemeToDocument(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
