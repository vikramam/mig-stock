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
  // Sharp, squared-off corners throughout — no soft "rounded rectangle" cards or
  // pill-shaped buttons/chips. Small radius (4px) keeps edges crisp without looking
  // like an unstyled 90s form.
  shape: { borderRadius: 4 },
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
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 4 },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } }
      }
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 2px rgba(38,36,32,0.05), 0 2px 6px rgba(38,36,32,0.06)'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 4 }
      }
    },
    MuiChip: {
      // MUI's default Chip is a fully rounded pill regardless of theme.shape —
      // square it off into a small tag instead.
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 600 }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#262420', color: '#FAF8F4', borderBottom: '1px solid rgba(255,255,255,0.08)' }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#6B6860'
        }
      }
    }
  }
})
