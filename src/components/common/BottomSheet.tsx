import { ReactNode } from 'react'
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { CloseIcon } from '../icons'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  /** Caps the sheet's width on wider viewports so it doesn't stretch full-bleed like a
   *  phone sheet would — it still anchors to the bottom, just centered and narrower. */
  maxWidth?: number
}

// Generic "native sheet" chrome — grab handle + optional header row + backdrop — shared
// by the mobile hamburger menu and the post-sale receipt/share sheet. Deliberately no
// menu- or receipt-specific logic lives here; callers own their own content and footer
// actions. Visual treatment (radius, glass blur, solid-below-`sm` fallback) comes from
// the MuiDrawer `anchor="bottom"` override in `theme.ts`.
export default function BottomSheet({ open, onClose, children, title, maxWidth }: BottomSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // MUI's default z-index scale puts Drawer (1200) BELOW Modal/Dialog (1300) — fine
      // when a sheet is the only overlay open, but SaleDetailDialog opens ReceiptDialog
      // (built on this component) on top of itself without closing first, and without
      // this override the sheet silently rendered behind the still-open Dialog. A sheet
      // should always be able to layer above a Dialog, so bump it above `modal` globally
      // rather than special-casing just the receipt sheet.
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      PaperProps={{
        sx: {
          maxWidth: maxWidth ?? 560,
          mx: 'auto',
          maxHeight: '88vh',
          pb: 'env(safe-area-inset-bottom)'
        }
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.5, mb: title ? 1 : 1.5 }} />
      {title && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pb: 1 }}>
          <Typography variant="subtitle1">{title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
      <Box sx={{ px: 2.5, pb: 2, overflowY: 'auto' }}>{children}</Box>
    </Drawer>
  )
}
