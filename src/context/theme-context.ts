import { createContext } from 'react'
import type { ThemeMode } from '../lib/theme-storage'

export type ThemeContextValue = {
  theme: ThemeMode
  isDark: boolean
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
