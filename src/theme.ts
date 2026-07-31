import { createTheme, PaletteMode } from '@mui/material/styles'

// Design direction: premium SaaS surface (Linear/Vercel-inspired dark, Apple/Stripe-inspired
// light) built on top of the original MIG identity — the amber accent (`#C97A2B`) and the
// Space Grotesk / Inter / JetBrains Mono type system carry over into both modes unchanged.
// Everything mode-specific (surface colors, borders, shadows, glass tint) is resolved once
// via `getModeTokens()` and threaded into `getTheme(mode)` — see `src/lib/themeMode.tsx` for
// the toggle + persistence that picks which mode gets rendered.

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

// Tokens shared by both modes.
const microTransition = 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease'
const glassBlur = 'blur(20px) saturate(180%)'

interface ModeTokens {
  background: { default: string; paper: string }
  text: { primary: string; secondary: string }
  border: string
  borderStrong: string
  cardShadow: string
  // Lighter shadow for transient overlay Paper (Menu/Select/Autocomplete popups) — those
  // already animate open/closed via MUI's own Grow/Fade transition, so they get a cheaper
  // shadow to repaint each frame instead of the full card shadow. See the mobile perf note
  // on MuiPaper below for why they also skip the fadeInUp animation entirely.
  popoverShadow: string
  appBarBg: string
  appBarShadow: string
  // Solid (no blur) fallback for AppBar/BottomNav/Dialog on mobile — see mobile perf note.
  mobileSolidBg: string
  bottomNavIconColor: string
  dialogBg: string
  bodyBackgroundImage: string
  buttonGlowAlpha: number
}

// Tailwind zinc scale for dark (950/900/800/100/400), slate scale for light typography
// (900/500), per the requested Linear/Vercel (dark) vs Apple/Stripe (light) references.
function getModeTokens(mode: PaletteMode): ModeTokens {
  if (mode === 'light') {
    return {
      background: { default: '#fafafa', paper: '#ffffff' },
      text: { primary: '#0f172a', secondary: '#64748b' },
      border: 'rgba(15,23,42,0.08)',
      borderStrong: 'rgba(15,23,42,0.14)',
      // "shadow-sm combined with ring" — a crisp 1px ring (via box-shadow, not a real
      // border) plus a soft, barely-there elevation shadow. No inset top highlight here:
      // that bevel trick only reads on dark surfaces.
      cardShadow: '0 0 0 1px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.05)',
      popoverShadow: '0 0 0 1px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.12)',
      appBarBg: 'rgba(255,255,255,0.75)',
      appBarShadow: '0 1px 2px rgba(15,23,42,0.04)',
      mobileSolidBg: 'rgba(255,255,255,0.96)',
      bottomNavIconColor: 'rgba(15,23,42,0.55)',
      dialogBg: 'rgba(255,255,255,0.88)',
      bodyBackgroundImage: 'none',
      buttonGlowAlpha: 0.28
    }
  }
  return {
    background: { default: '#09090b', paper: '#18181b' },
    text: { primary: '#F4F4F5', secondary: '#A1A1AA' },
    border: '#27272a',
    borderStrong: '#3F3F46',
    cardShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -8px rgba(0,0,0,0.55)',
    popoverShadow: '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.35)',
    appBarBg: 'rgba(9,9,11,0.72)',
    appBarShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)',
    mobileSolidBg: 'rgba(9,9,11,0.96)',
    bottomNavIconColor: 'rgba(244,244,245,0.6)',
    dialogBg: 'rgba(24,24,27,0.82)',
    // Subtle ambient glow — dark mode only, applied once at the body level (not per-page)
    // so every screen gets it consistently instead of hand-rolling it per component.
    bodyBackgroundImage: 'radial-gradient(circle at 50% -10%, rgba(201,122,43,0.16), transparent 55%)',
    buttonGlowAlpha: 0.4
  }
}

export function getTheme(mode: PaletteMode) {
  const t = getModeTokens(mode)

  return createTheme({
    palette: {
      mode,
      primary: { main: '#C97A2B', dark: '#9C5D1E', light: '#E0A461', contrastText: '#1B1710' },
      secondary: { main: '#3E6680', dark: '#2C4A5E', light: '#6C93AB', contrastText: '#FFFFFF' },
      success: { main: '#5FB158' },
      warning: { main: '#D9822B' },
      error: { main: '#E5564A' },
      background: t.background,
      text: t.text,
      divider: t.border
    },
    // Rounded-xl/2xl baseline for cards/dialogs; buttons/chips use a slightly tighter
    // radius (see their own overrides below) so small controls don't look pill-shaped.
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      // Tight, increasingly negative tracking as size goes up — plus a real weight jump
      // versus body text — is what gives the type scale its "premium SaaS" contrast.
      h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '-0.04em' },
      h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '-0.035em' },
      h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '-0.03em' },
      h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '-0.025em' },
      h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h6: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600, letterSpacing: '-0.01em' },
      mono: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // `background-attachment: fixed` is a known severe mobile Safari perf hazard
          // (forces a full background repaint on layout shifts, e.g. the keyboard opening
          // when a field is focused) — dropped in favor of a plain scrolling background.
          body: {
            backgroundImage: t.bodyBackgroundImage
          },
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
          },
          // Respect reduced-motion system setting — kills every animation/transition's
          // duration app-wide (entrance fades, hover scales, skeleton shimmer) rather than
          // trying to remember to guard each one individually.
          '@media (prefers-reduced-motion: reduce)': {
            '*': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important'
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            borderRadius: 10,
            transition: microTransition,
            '&:hover': { transform: 'scale(1.02)' },
            '&:active': { transform: 'scale(0.98)' }
          },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } }
        },
        variants: [
          {
            // The one flat-fill case the ask calls out for a gradient/glow CTA treatment —
            // every plain `variant="contained"` Button is color="primary" by default, so
            // this covers save/submit/primary actions app-wide without touching each page.
            props: { variant: 'contained', color: 'primary' },
            style: {
              backgroundImage: 'linear-gradient(135deg, #E0A461 0%, #C97A2B 60%, #9C5D1E 100%)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px rgba(201,122,43,${t.buttonGlowAlpha}), 0 1px 2px rgba(0,0,0,0.3)`,
              '&:hover': {
                backgroundImage: 'linear-gradient(135deg, #E8B276 0%, #D3872F 60%, #A8672A 100%)',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 22px rgba(201,122,43,${Math.min(t.buttonGlowAlpha + 0.15, 0.7)}), 0 2px 4px rgba(0,0,0,0.35)`,
                transform: 'translateY(-1px) scale(1.02)'
              },
              '&:active': { transform: 'scale(0.98)' },
              '&.Mui-disabled': { backgroundImage: 'none', boxShadow: 'none' }
            }
          },
          {
            // Outlined primary actions (e.g. secondary dialog buttons) get a matching but
            // lighter amber glow on hover instead of the default MUI tint-only feedback.
            props: { variant: 'outlined', color: 'primary' },
            style: {
              '&:hover': {
                borderColor: 'rgba(201,122,43,0.6)',
                boxShadow: '0 0 0 3px rgba(201,122,43,0.14)'
              }
            }
          }
        ]
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: microTransition,
            '&:hover': { transform: 'scale(1.08)' },
            '&:active': { transform: 'scale(0.94)' }
          }
        }
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${t.border}`,
            boxShadow: t.cardShadow,
            // Every card fades + slides in on mount — covers dashboard tiles, list rows,
            // and dialogs without touching each page.
            animation: 'fadeInUp 0.4s ease both',
            // Menu/Select/Autocomplete/Dialog popups already animate their own open/close
            // via MUI's Grow/Fade transition (JS-driven, per-frame inline `transform`). The
            // fadeInUp CSS animation above was ALSO fighting over `transform` on the same
            // element at the same time — two animation systems driving one property — which
            // is what made dropdowns feel laggy/stuttery, especially on mobile. These also
            // get the lighter popoverShadow instead of the full card shadow: they open/close
            // far more often than a static card, so a cheaper-to-repaint shadow matters more
            // than it does for content that mounts once.
            '&.MuiPopover-paper, &.MuiMenu-paper, &.MuiAutocomplete-paper, &.MuiDialog-paper': {
              animation: 'none',
              boxShadow: t.popoverShadow
            }
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 20,
            backgroundColor: t.dialogBg,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            border: `1px solid ${t.borderStrong}`,
            // backdrop-filter is one of the most GPU-expensive CSS properties there is, and
            // a Dialog is exactly the kind of surface that opens/closes constantly on a
            // phone — drop the blur below `sm` in favor of a near-opaque flat background.
            [theme.breakpoints.down('sm')]: {
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              backgroundColor: t.mobileSolidBg
            }
          })
        }
      },
      MuiChip: {
        // MUI's default Chip is a fully rounded pill regardless of theme.shape —
        // square it off (slightly) into a small tag instead.
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            transition: microTransition,
            // Scoped to .MuiChip-clickable (only present when a Chip has onClick/onDelete)
            // so static status tags like "PAID"/"PENDING" don't get a misleading hover cue.
            '&.MuiChip-clickable:hover': { transform: 'scale(1.05)' },
            '&.MuiChip-clickable:active': { transform: 'scale(0.96)' }
          }
        }
      },
      MuiSkeleton: {
        defaultProps: { animation: 'wave' }
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: t.appBarBg,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            color: t.text.primary,
            borderBottom: `1px solid ${t.border}`,
            boxShadow: t.appBarShadow,
            // The AppBar is sticky and always on screen, so its blur is a continuous GPU
            // cost, not just an on-open one — every scroll/animation/modal nearby forces the
            // browser to recomposite it. Drop it below `sm`, where that cost is most visible.
            [theme.breakpoints.down('sm')]: {
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              backgroundColor: t.mobileSolidBg
            }
          })
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: t.text.secondary
          }
        }
      },
      MuiBottomNavigation: {
        styleOverrides: {
          // Fixed + always-visible, same reasoning as MuiAppBar above — this one arguably
          // matters more, since it's mobile-only in the first place.
          root: {
            backgroundColor: t.mobileSolidBg,
            borderTop: `1px solid ${t.border}`
          }
        }
      },
      MuiBottomNavigationAction: {
        defaultProps: { showLabel: true },
        styleOverrides: {
          root: ({ theme }) => ({
            position: 'relative',
            minWidth: 0,
            paddingTop: 10,
            color: t.bottomNavIconColor,
            '&.Mui-selected': {
              color: theme.palette.primary.main
            },
            '&.Mui-selected::after': {
              content: '""',
              position: 'absolute',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 20,
              height: 2,
              borderRadius: 1,
              backgroundColor: theme.palette.primary.main
            }
          }),
          label: {
            fontSize: '0.65rem',
            '&.Mui-selected': { fontSize: '0.65rem' }
          }
        }
      }
    }
  })
}
