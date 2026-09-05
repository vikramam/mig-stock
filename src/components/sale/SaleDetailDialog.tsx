import { ReactNode, useEffect, useState } from 'react'
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
  IconButton,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material'
import { CloseIcon } from '../icons'
import ReceiptIcon from '@mui/icons-material/ReceiptLongSharp'
import PaymentsIcon from '@mui/icons-material/PaymentsSharp'
import EditIcon from '@mui/icons-material/EditSharp'
import CancelIcon from '@mui/icons-material/CancelSharp'
import DeleteForeverIcon from '@mui/icons-material/DeleteForeverSharp'
import { supabase, formatMoney, parseRupeesToPaise } from '../../lib/supabase'
import { Sale, SaleItem, Payment } from '../../types'
import ReceiptDialog from './ReceiptDialog'

// Shared chrome for each of the 4 independent action sections (record payment, edit,
// cancel, delete) — a bordered, tinted card with an icon + label header, so the sections
// read as distinct "zones" instead of the previous flat Divider-separated Stack. Tint is
// keyed by severity so destructive actions (cancel/delete) visually stand apart from the
// neutral payment/edit ones, matching how Alert severities already read in this dialog.
function ActionSection({
  icon,
  label,
  severity = 'neutral',
  children
}: {
  icon: ReactNode
  label: string
  severity?: 'neutral' | 'warning' | 'error'
  children: ReactNode
}) {
  const borderColor =
    severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'divider'
  const iconColor = severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'text.secondary'

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor,
        borderRadius: 3,
        p: 2,
        opacity: severity === 'error' || severity === 'warning' ? 1 : 0.96
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: iconColor }}>
          {icon}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: '0.72rem' }}>
            {label}
          </Typography>
        </Stack>
        {children}
      </Stack>
    </Box>
  )
}

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
  const theme = useTheme()
  // Stays a Dialog (never a swipe-to-dismiss BottomSheet, per the redesign plan — this
  // screen hosts 4 stateful confirm-flows where an accidental swipe mid-typed cancellation
  // reason would risk real data loss), but goes full-screen below `sm` so the largest
  // dialog in the app gets full vertical room on a phone instead of a cramped centered card.
  const fullScreenOnMobile = useMediaQuery(theme.breakpoints.down('sm'))
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

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
      setConfirmingDelete(false)
      setDeleteError(null)
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

  // Only offered for already-cancelled sales — a hard delete, unlike Cancel, which keeps
  // the sale as an audit-trail row. sale_items and payments cascade-delete with it; the
  // stock_movements ledger rows for this sale are left untouched (the ledger stays the
  // permanent source of truth for stock even after the sale record itself is gone).
  async function handleDeleteSale() {
    if (!sale) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.from('sales').delete().eq('id', sale.id)

    setDeleting(false)
    if (error) {
      setDeleteError(error.message)
      return
    }

    onChanged()
    onClose()
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

  const totalDiscount = items.reduce((sum, it) => sum + it.discount_amount, 0)
  const hasDiscount = totalDiscount > 0
  const subtotal = items.reduce((sum, it) => sum + it.qty * it.unit_price_at_sale, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreenOnMobile}
      PaperProps={fullScreenOnMobile ? { sx: { borderRadius: 0 } } : undefined}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: { xs: 2.5, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {sale ? sale.receipt_no : 'Sale'}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5 }}>
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
                  {hasDiscount && <TableCell align="right">Discount</TableCell>}
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
                    {hasDiscount && (
                      <TableCell align="right">
                        {item.discount_amount > 0 ? (
                          <Typography variant="mono" color="success.main">
                            −{formatMoney(item.discount_amount)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(item.line_total)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider />

            <Stack spacing={0.5}>
              {hasDiscount && (
                <>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Subtotal
                    </Typography>
                    <Typography variant="mono">{formatMoney(subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="success.main">
                      Discount
                    </Typography>
                    <Typography variant="mono" color="success.main">
                      −{formatMoney(totalDiscount)}
                    </Typography>
                  </Stack>
                </>
              )}
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

            {(sale.status === 'active' || sale.status === 'cancelled') && (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  {sale.status === 'active' && sale.balance_due > 0 && (
                    <ActionSection icon={<PaymentsIcon fontSize="small" />} label="Record payment">
                      {recordError && <Alert severity="error">{recordError}</Alert>}
                      <Stack direction="row" gap={1}>
                        <TextField
                          placeholder="Amount (Rs.)"
                          type="number"
                          size="small"
                          inputProps={{ 'aria-label': 'Amount (Rs.)', step: '0.01', min: 0 }}
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
                        placeholder="Note (optional)"
                        size="small"
                        inputProps={{ 'aria-label': 'Note (optional)' }}
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
                    </ActionSection>
                  )}

                  {sale.status === 'active' && !confirmingCancel && (
                    <ActionSection icon={<EditIcon fontSize="small" />} label="Edit sale">
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
                    </ActionSection>
                  )}

                  {sale.status === 'active' && !confirmingEdit && (
                    <ActionSection icon={<CancelIcon fontSize="small" />} label="Cancel sale" severity="warning">
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
                            placeholder="Cancelled by (optional)"
                            size="small"
                            inputProps={{ 'aria-label': 'Cancelled by (optional)' }}
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
                    </ActionSection>
                  )}

                  {sale.status === 'cancelled' && (
                    <ActionSection icon={<DeleteForeverIcon fontSize="small" />} label="Delete permanently" severity="error">
                      {!confirmingDelete ? (
                        <Button color="error" variant="outlined" onClick={() => setConfirmingDelete(true)} sx={{ alignSelf: 'flex-start' }}>
                          Delete permanently
                        </Button>
                      ) : (
                        <Stack spacing={1.5}>
                          <Alert severity="error">
                            This permanently removes this cancelled sale and its line items and payments from your records.
                            Unlike Cancel, this cannot be undone — there's no audit-trail row left behind.
                          </Alert>
                          {deleteError && <Alert severity="error">{deleteError}</Alert>}
                          <Stack direction="row" gap={1}>
                            <Button onClick={() => setConfirmingDelete(false)}>Back</Button>
                            <Button color="error" variant="contained" disabled={deleting} onClick={() => void handleDeleteSale()}>
                              Delete permanently
                            </Button>
                          </Stack>
                        </Stack>
                      )}
                    </ActionSection>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Button onClick={onClose}>Close</Button>
        {sale && (
          <Button variant="outlined" startIcon={<ReceiptIcon />} onClick={() => setReceiptOpen(true)}>
            Receipt
          </Button>
        )}
      </DialogActions>

      <ReceiptDialog open={receiptOpen} saleId={saleId} onClose={() => setReceiptOpen(false)} />
    </Dialog>
  )
}
