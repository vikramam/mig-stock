import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  Divider,
  TextField,
  Button,
  Alert,
  Skeleton,
  IconButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseSharp'
import ReceiptIcon from '@mui/icons-material/ReceiptLongSharp'
import { supabase, formatMoney, parseRupeesToPaise } from '../../lib/supabase'
import { Sale, SaleItem, Payment } from '../../types'
import ReceiptDialog from './ReceiptDialog'

type SaleWithCustomer = Sale & { customers: { name: string } | null }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SaleDetailDialog({
  open,
  saleId,
  onClose,
  onChanged
}: {
  open: boolean
  saleId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sale, setSale] = useState<SaleWithCustomer | null>(null)
  const [items, setItems] = useState<SaleItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

  const [receiptOpen, setReceiptOpen] = useState(false)

  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelledBy, setCancelledBy] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [confirmingEdit, setConfirmingEdit] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (open && saleId) void loadDetail(saleId)
    if (!open) {
      setPaymentAmount('')
      setPaymentNote('')
      setRecordError(null)
      setConfirmingCancel(false)
      setCancelledBy('')
      setCancelError(null)
      setConfirmingEdit(false)
      setEditError(null)
    }
  }, [open, saleId])

  async function loadDetail(id: string) {
    setLoading(true)
    setLoadError(null)

    const [{ data: saleData, error: saleError }, { data: itemsData, error: itemsError }, { data: paymentsData, error: paymentsError }] =
      await Promise.all([
        supabase.from('sales').select('*, customers(name)').eq('id', id).single(),
        supabase.from('sale_items').select('*').eq('sale_id', id),
        supabase.from('payments').select('*').eq('sale_id', id).order('paid_at', { ascending: true })
      ])

    const error = saleError || itemsError || paymentsError
    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }

    setSale(saleData as unknown as SaleWithCustomer)
    setItems((itemsData ?? []) as SaleItem[])
    setPayments((paymentsData ?? []) as Payment[])
    setLoading(false)
  }

  async function handleRecordPayment() {
    if (!sale) return
    const amountPaise = parseRupeesToPaise(paymentAmount)
    if (amountPaise <= 0) return

    setRecording(true)
    setRecordError(null)
    const { error } = await supabase.rpc('record_payment', {
      p_sale_id: sale.id,
      p_amount: amountPaise,
      p_note: paymentNote.trim() || null
    })

    setRecording(false)
    if (error) {
      setRecordError(error.message)
      return
    }

    setPaymentAmount('')
    setPaymentNote('')
    await loadDetail(sale.id)
    onChanged()
  }

  async function handleCancelSale() {
    if (!sale) return
    setCancelling(true)
    setCancelError(null)
    const { error } = await supabase.rpc('cancel_sale', {
      p_sale_id: sale.id,
      p_created_by: cancelledBy.trim() || null
    })

    setCancelling(false)
    if (error) {
      setCancelError(error.message)
      return
    }

    setConfirmingCancel(false)
    await loadDetail(sale.id)
    onChanged()
  }

  // Editing a sale = cancel it and reopen New Sale pre-filled with its items, per the
  // ledger design — never patch an existing sale's line items in place.
  async function handleEditSale() {
    if (!sale) return
    setEditing(true)
    setEditError(null)
    const { error } = await supabase.rpc('cancel_sale', {
      p_sale_id: sale.id,
      p_created_by: null
    })

    setEditing(false)
    if (error) {
      setEditError(error.message)
      return
    }

    onChanged()
    onClose()
    navigate('/sale/new', {
      state: {
        prefillCustomerId: sale.customer_id,
        prefillNote: sale.note,
        prefillItems: items.map((it) => ({ variant_id: it.variant_id, qty: it.qty }))
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {sale ? sale.receipt_no : 'Sale'}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Stack spacing={2}>
            <Stack direction="row" gap={1}>
              <Skeleton variant="rounded" width={64} height={24} />
              <Skeleton variant="rounded" width={64} height={24} />
            </Stack>
            <Stack spacing={0.75}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="55%" />
            </Stack>
            <Skeleton variant="rounded" height={100} />
            <Stack spacing={0.75}>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="60%" />
            </Stack>
          </Stack>
        )}

        {!loading && loadError && <Alert severity="error">Failed to load sale: {loadError}</Alert>}

        {!loading && sale && (
          <Stack spacing={2}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                label={sale.status === 'active' ? 'Active' : 'Cancelled'}
                color={sale.status === 'active' ? 'default' : 'error'}
              />
              <Chip
                size="small"
                label={sale.payment_status === 'paid' ? 'Paid' : 'Pending'}
                color={sale.payment_status === 'paid' ? 'success' : 'warning'}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(sale.created_at)}
              </Typography>
              <Typography variant="body2">Customer: {sale.customers?.name ?? 'Walk-in'}</Typography>
              {sale.created_by && <Typography variant="body2">Sold by: {sale.created_by}</Typography>}
              {sale.note && <Typography variant="body2">Note: {sale.note}</Typography>}
              {sale.status === 'cancelled' && sale.cancelled_at && (
                <Typography variant="body2" color="error.main">
                  Cancelled {formatDateTime(sale.cancelled_at)}
                </Typography>
              )}
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Line total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_snapshot}</TableCell>
                    <TableCell align="right">{item.qty}</TableCell>
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(item.unit_price_at_sale)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(item.line_total)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider />

            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="mono">{formatMoney(sale.total)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Paid
                </Typography>
                <Typography variant="mono">{formatMoney(sale.amount_paid)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">Balance due</Typography>
                <Typography variant="mono" color={sale.balance_due > 0 ? 'warning.main' : 'text.primary'}>
                  {formatMoney(sale.balance_due)}
                </Typography>
              </Stack>
            </Stack>

            {payments.length > 0 && (
              <>
                <Divider />
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Payments</Typography>
                  {payments.map((p) => (
                    <Stack key={p.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(p.paid_at)}
                        {p.note ? ` · ${p.note}` : ''}
                      </Typography>
                      <Typography variant="mono">{formatMoney(p.amount)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}

            {sale.status === 'active' && sale.balance_due > 0 && (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Record payment</Typography>
                  {recordError && <Alert severity="error">{recordError}</Alert>}
                  <Stack direction="row" gap={1}>
                    <TextField
                      label="Amount (Rs.)"
                      type="number"
                      size="small"
                      inputProps={{ step: '0.01', min: 0 }}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="text"
                      onClick={() => setPaymentAmount(String(sale.balance_due / 100))}
                    >
                      Full balance
                    </Button>
                  </Stack>
                  <TextField
                    label="Note (optional)"
                    size="small"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    disabled={recording || parseRupeesToPaise(paymentAmount) <= 0}
                    onClick={() => void handleRecordPayment()}
                  >
                    Record payment
                  </Button>
                </Stack>
              </>
            )}

            {sale.status === 'active' && !confirmingCancel && (
              <>
                <Divider />
                {!confirmingEdit ? (
                  <Button variant="outlined" onClick={() => setConfirmingEdit(true)} sx={{ alignSelf: 'flex-start' }}>
                    Edit sale
                  </Button>
                ) : (
                  <Stack spacing={1.5}>
                    <Alert severity="info">
                      This cancels the current sale (reversing its stock) and reopens New Sale with the same customer and
                      items, so you can change quantities or items and complete it as a fresh sale.
                    </Alert>
                    {editError && <Alert severity="error">{editError}</Alert>}
                    <Stack direction="row" gap={1}>
                      <Button onClick={() => setConfirmingEdit(false)}>Back</Button>
                      <Button variant="contained" disabled={editing} onClick={() => void handleEditSale()}>
                        Cancel & edit
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </>
            )}

            {sale.status === 'active' && !confirmingEdit && (
              <>
                <Divider />
                {!confirmingCancel ? (
                  <Button color="error" variant="outlined" onClick={() => setConfirmingCancel(true)} sx={{ alignSelf: 'flex-start' }}>
                    Cancel sale
                  </Button>
                ) : (
                  <Stack spacing={1.5}>
                    <Alert severity="warning">
                      This reverses all stock movements from this sale and marks it cancelled. This cannot be undone.
                    </Alert>
                    {cancelError && <Alert severity="error">{cancelError}</Alert>}
                    <TextField
                      label="Cancelled by (optional)"
                      size="small"
                      placeholder="e.g. owner, father"
                      value={cancelledBy}
                      onChange={(e) => setCancelledBy(e.target.value)}
                      fullWidth
                    />
                    <Stack direction="row" gap={1}>
                      <Button onClick={() => setConfirmingCancel(false)}>Back</Button>
                      <Button color="error" variant="contained" disabled={cancelling} onClick={() => void handleCancelSale()}>
                        Confirm cancellation
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {sale && (
          <Button startIcon={<ReceiptIcon />} onClick={() => setReceiptOpen(true)}>
            Receipt
          </Button>
        )}
      </DialogActions>

      <ReceiptDialog open={receiptOpen} saleId={saleId} onClose={() => setReceiptOpen(false)} />
    </Dialog>
  )
}
