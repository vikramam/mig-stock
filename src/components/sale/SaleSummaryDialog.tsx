import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Box, Typography, Divider } from '@mui/material'
import { formatMoney } from '../../lib/supabase'

export interface SaleSummaryLine {
  key: string
  label: string
  sizeLabel: string | null
  qty: number
  unitPrice: number
  discount: number
  lineTotal: number
}

export default function SaleSummaryDialog({
  open,
  onClose,
  customerName,
  saleDateLabel,
  lines,
  totalDiscount,
  total,
  amountPaid,
  balanceDue,
  onConfirm,
  confirming
}: {
  open: boolean
  onClose: () => void
  customerName: string
  /** Only shown when the sale is back-dated — null hides the row entirely. */
  saleDateLabel: string | null
  lines: SaleSummaryLine[]
  totalDiscount: number
  total: number
  amountPaid: number
  balanceDue: number
  /** Optional — lets the user complete the sale directly from the summary instead of
   *  closing it and reaching for the sticky "Complete sale" button. Purely a shortcut:
   *  the summary is otherwise just a look-before-you-buy preview, per the owner's spec
   *  ("this is option user can click or he can ignore also"). */
  onConfirm: () => void
  confirming: boolean
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Sale summary</DialogTitle>
      <DialogContent>
        <Stack spacing={0.25} sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {customerName}
          </Typography>
          {saleDateLabel && (
            <Typography variant="caption" color="warning.main">
              Sale date: {saleDateLabel}
            </Typography>
          )}
        </Stack>

        <Stack spacing={1.5} divider={<Divider />}>
          {lines.map((line) => (
            <Stack key={line.key} direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {line.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {line.sizeLabel ? `${line.sizeLabel} · ` : ''}
                  {line.qty} × {formatMoney(line.unitPrice)}
                </Typography>
                {line.discount > 0 && (
                  <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                    −{formatMoney(line.discount)} discount
                  </Typography>
                )}
              </Box>
              <Typography variant="mono" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {formatMoney(line.lineTotal)}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={0.5}>
          {totalDiscount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Discount
              </Typography>
              <Typography variant="mono" color="success.main">
                −{formatMoney(totalDiscount)}
              </Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Total
            </Typography>
            <Typography variant="mono" sx={{ fontWeight: 700 }}>
              {formatMoney(total)}
            </Typography>
          </Stack>
          {amountPaid > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Amount received
              </Typography>
              <Typography variant="mono">{formatMoney(amountPaid)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>
              Balance due
            </Typography>
            <Typography variant="mono" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>
              {formatMoney(balanceDue)}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Back to cart</Button>
        <Button variant="contained" disabled={confirming} onClick={onConfirm}>
          Complete sale
        </Button>
      </DialogActions>
    </Dialog>
  )
}
