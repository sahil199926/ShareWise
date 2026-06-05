export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'expense_tracker_theme'

export const getStoredTheme = (): ThemeMode | null => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
    return null
  } catch {
    return null
  }
}

export const setStoredTheme = (theme: ThemeMode) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export const applyThemeToDocument = (theme: ThemeMode) => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
