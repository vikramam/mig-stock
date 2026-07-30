import { createTheme } from '@mui/material/styles'

// Design direction: a hardware/workshop identity, not a generic SaaS blue-and-white.
// Warm steel-gray surfaces, charcoal text, a safety-amber accent (like machinery
// warning paint), and monospace for anything numeric — stock counts, prices,
// receipt numbers — so the app reads like a shop ledger rather than a dashboard template.

declare module '@mui/material/styles' {
  interface TypographyVariants {
    mono: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    mono?: React.CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#C97A2B', dark: '#9C5D1E', light: '#E0A461', contrastText: '#1B1710' },
    secondary: { main: '#3E6680', dark: '#2C4A5E', light: '#6C93AB', contrastText: '#FFFFFF' },
    success: { main: '#4C7A3D' },
    warning: { main: '#D9822B' },
    error: { main: '#B23B2E' },
    background: { default: '#ECE9E2', paper: '#FAF8F4' },
    text: { primary: '#262420', secondary: '#6B6860' },
    divider: '#DAD6CC'
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
    h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 500 },
    h6: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 500 },
    mono: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#262420', color: '#FAF8F4' }
      }
    }
  }
})
