import { createContext, useContext, useEffect, useMemo, useState, PropsWithChildren } from 'react'
import { ThemeProvider, PaletteMode } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from '../theme'

const STORAGE_KEY = 'mig-theme-mode'

// Per-device UI preference, not shop config — deliberately NOT stored in the `settings`
// table (that's shared across the owner/father's single login and every device).
function getInitialMode(): PaletteMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

interface ThemeModeContextValue {
  mode: PaletteMode
  toggleMode: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined)

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode)
  const theme = useMemo(() => getTheme(mode), [mode])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
    // Keep the browser chrome/PWA status bar color in sync with whichever mode is active.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.palette.background.default)
  }, [mode, theme])

  function toggleMode() {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider')
  return ctx
}
