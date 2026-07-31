import { forwardRef, useState } from 'react'
import { Box, Typography, Stack, Divider } from '@mui/material'
import { formatMoney } from '../../lib/supabase'
import { PaymentStatus } from '../../types'

// Place your logo file at public/logo.png (create the file there — it's served as
// /logo.png both in dev and in the deployed build). Same-origin, so no CORS handling
// needed for html2canvas to capture it, unlike the Storage-hosted product images below.
const LOGO_SRC = '/logo.png'

export interface ReceiptItem {
  label: string
  imageUrl: string | null
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface ReceiptData {
  companyName: string
  receiptFooter: string | null
  receiptNo: string
  createdAt: string
  customerName: string | null
  items: ReceiptItem[]
  total: number
  amountPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
}

// The receipt is always rendered as a fixed white card, independent of the app's own
// theme (light or dark) — it gets captured to PNG/PDF and shared/printed, so it must stay
// legible on white and consistent regardless of what the in-app palette looks like at the
// moment someone hits share. It borrows the app's new visual language (rounded corners,
// a soft ring/shadow instead of a flat border, tight header tracking, the amber accent bar)
// but every color below is a fixed constant, never a theme token.
const RECEIPT_MUTED = '#6B6860'
const RECEIPT_DIVIDER = '#DAD6CC'
const RECEIPT_ACCENT_GRADIENT = 'linear-gradient(90deg, #E0A461, #C97A2B, #9C5D1E)'

// Display-only formatting — never touches the stored receipt_no/item_snapshot, both of
// which are frozen historical data (see "Sales" and "Receipt" sections in CLAUDE.md).
function formatReceiptNoForDisplay(receiptNo: string): string {
  return receiptNo.replace(/^MIG_/, '')
}

function formatItemLabelForDisplay(label: string): string {
  return label.replace(/\s*\/\s*/g, ' - ')
}

const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(function Receipt({ data }, ref) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <Box
      ref={ref}
      sx={{
        width: 380,
        mx: 'auto',
        bgcolor: '#FFFFFF',
        color: '#1B1710',
        borderRadius: '20px',
        // A crisp ring (no blur) rather than a soft drop shadow — html2canvas crops
        // anything blurred past the element's own box, so a blurred shadow here would
        // get clipped in the exported PNG/PDF. Ring shadows sit flush at the edge instead.
        boxShadow: '0 0 0 1px rgba(15,23,42,0.08)',
        p: 3.5
      }}
    >
      {!logoFailed && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Box
            component="img"
            src={LOGO_SRC}
            alt={data.companyName}
            onError={() => setLogoFailed(true)}
            sx={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain' }}
          />
        </Box>
      )}
      <Typography variant="h5" align="center" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>
        {data.companyName}
      </Typography>
      <Typography variant="body2" align="center" sx={{ color: RECEIPT_MUTED }}>
        {formatReceiptNoForDisplay(data.receiptNo)}
      </Typography>
      <Typography variant="body2" align="center" sx={{ color: RECEIPT_MUTED }}>
        {new Date(data.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
        <Box sx={{ width: 48, height: 3, borderRadius: '999px', backgroundImage: RECEIPT_ACCENT_GRADIENT }} />
      </Box>

      <Typography variant="body2" sx={{ mt: 1 }}>
        Customer: {data.customerName ?? 'Walk-in'}
      </Typography>

      <Divider sx={{ my: 1.5, borderColor: RECEIPT_DIVIDER }} />

      <Stack spacing={1.5}>
        {data.items.map((item, i) => (
          <Stack key={i} direction="row" gap={1.25} alignItems="center">
            {item.imageUrl && (
              <Box
                component="img"
                src={item.imageUrl}
                crossOrigin="anonymous"
                sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{formatItemLabelForDisplay(item.label)}</Typography>
              <Typography variant="caption" sx={{ color: RECEIPT_MUTED }}>
                {item.qty} x {formatMoney(item.unitPrice)}
              </Typography>
            </Box>
            <Typography variant="mono">{formatMoney(item.lineTotal)}</Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5, borderColor: RECEIPT_DIVIDER }} />

      <Stack spacing={0.5}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">Total</Typography>
          <Typography variant="mono">{formatMoney(data.total)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">Paid</Typography>
          <Typography variant="mono">{formatMoney(data.amountPaid)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="subtitle2">Balance due</Typography>
          <Typography variant="mono">{formatMoney(data.balanceDue)}</Typography>
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              bgcolor: data.paymentStatus === 'paid' ? 'rgba(76,163,80,0.12)' : 'rgba(217,130,43,0.14)',
              color: data.paymentStatus === 'paid' ? '#2F7A34' : '#9C5D1E'
            }}
          >
            {data.paymentStatus === 'paid' ? 'Paid in full' : 'Payment pending'}
          </Box>
        </Box>
      </Stack>

      {data.receiptFooter && (
        <>
          <Divider sx={{ my: 1.5, borderColor: RECEIPT_DIVIDER }} />
          <Typography variant="body2" align="center" sx={{ color: RECEIPT_MUTED }}>
            {data.receiptFooter}
          </Typography>
        </>
      )}
    </Box>
  )
})

export default Receipt
