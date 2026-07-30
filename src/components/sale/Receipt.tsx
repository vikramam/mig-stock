import { forwardRef } from 'react'
import { Box, Typography, Stack, Divider } from '@mui/material'
import { formatMoney } from '../../lib/supabase'
import { PaymentStatus } from '../../types'

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

const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(function Receipt({ data }, ref) {
  return (
    <Box ref={ref} sx={{ width: 380, mx: 'auto', bgcolor: '#FFFFFF', color: '#1B1710', p: 3 }}>
      <Typography variant="h5" align="center" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>
        {data.companyName}
      </Typography>
      <Typography variant="body2" align="center" color="text.secondary">
        Receipt {data.receiptNo}
      </Typography>
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
        {new Date(data.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </Typography>

      <Typography variant="body2">Customer: {data.customerName ?? 'Walk-in'}</Typography>

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1.5}>
        {data.items.map((item, i) => (
          <Stack key={i} direction="row" gap={1} alignItems="center">
            {item.imageUrl && (
              <Box
                component="img"
                src={item.imageUrl}
                crossOrigin="anonymous"
                sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.qty} x {formatMoney(item.unitPrice)}
              </Typography>
            </Box>
            <Typography variant="mono">{formatMoney(item.lineTotal)}</Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

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
        <Typography variant="body2" align="center" sx={{ mt: 1, fontWeight: 600 }}>
          {data.paymentStatus === 'paid' ? 'PAID IN FULL' : 'PAYMENT PENDING'}
        </Typography>
      </Stack>

      {data.receiptFooter && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" align="center" color="text.secondary">
            {data.receiptFooter}
          </Typography>
        </>
      )}
    </Box>
  )
})

export default Receipt
