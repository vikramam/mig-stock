import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import { DeleteIcon, AddIcon as PersonAddIcon, ChevronRightIcon, PersonIcon, CheckIcon, BackIcon } from '../components/icons'
import { supabase, formatMoney, parseRupeesToPaise, fetchActiveVariants, fetchVariantSalesTotals } from '../lib/supabase'
import { Customer, VariantWithContext, formatVariantLabel, formatSize } from '../types'
import CustomerDialog, { CustomerDialogValues } from '../components/sale/CustomerDialog'
import ReceiptDialog from '../components/sale/ReceiptDialog'
import QtyStepper from '../components/QtyStepper'
import { FormSkeleton } from '../components/skeletons'
import BottomSheet from '../components/common/BottomSheet'
import ProductTypeSizePicker from '../components/catalog/ProductTypeSizePicker'

interface CartLine {
  variant: VariantWithContext
  qty: number
}

interface EditPrefillState {
  prefillCustomerId?: string | null
  prefillNote?: string | null
  prefillItems?: { variant_id: string; qty: number }[]
}

// "Full amount received" reads as a flat secondary action, not a bordered/outlined
// button — matches the prototype's card-style buttons. (The fields themselves no longer
// need a local override now that the flat-pill look is a theme-wide MuiOutlinedInput
// default — see src/theme.ts.)
const flatButtonSx = {
  bgcolor: 'action.hover',
  color: 'text.primary',
  fontWeight: 700,
  borderRadius: 1,
  py: 1.5,
  boxShadow: 'none',
  '&:hover': { bgcolor: 'action.selected', boxShadow: 'none' }
}

export default function NewSale() {
  const location = useLocation()
  const navigate = useNavigate()
  const appliedPrefillRef = useRef(false)
  const [prefillNotice, setPrefillNotice] = useState(false)
  const [prefillMissingCount, setPrefillMissingCount] = useState(0)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [variants, setVariants] = useState<VariantWithContext[]>([])
  const [topSellers, setTopSellers] = useState<VariantWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [discountApplied, setDiscountApplied] = useState(false)

  const [amountPaid, setAmountPaid] = useState('')
  const [note, setNote] = useState('')
  const [createdBy, setCreatedBy] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ receiptNo: string; total: number; balanceDue: number } | null>(null)
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const [
      { data: customersData, error: customersError },
      { data: variantsData, error: variantsError },
      { data: salesTotals }
    ] = await Promise.all([
      supabase.from('customers').select('*').eq('is_deleted', false).order('name', { ascending: true }),
      fetchActiveVariants(),
      fetchVariantSalesTotals()
    ])

    if (customersError) {
      setLoadError(customersError.message)
      setLoading(false)
      return
    }
    if (variantsError) {
      setLoadError(variantsError)
      setLoading(false)
      return
    }

    setCustomers((customersData ?? []) as Customer[])
    setVariants(variantsData)
    // Rank only the currently-active variant list against sales history — this way a
    // deactivated product/type's variant is never a candidate at all, rather than being
    // ranked in and then dropped after the top-4 slice (which would shrink the result
    // below 4 instead of backfilling from the next-best active variant).
    setTopSellers(
      variantsData
        .filter((v) => (salesTotals[v.id] ?? 0) > 0)
        .sort((a, b) => (salesTotals[b.id] ?? 0) - (salesTotals[a.id] ?? 0))
        .slice(0, 4)
    )
    setLoading(false)
  }

  // Consumes the one-shot prefill passed via navigate() state when editing a cancelled
  // sale (see SaleDetailDialog's "Edit sale"). Guarded by a ref so it only ever applies
  // once — loadAll() re-runs after every completed sale, and re-applying stale state
  // from location.state at that point would silently repopulate the cart.
  useEffect(() => {
    if (appliedPrefillRef.current || loading) return
    const state = location.state as EditPrefillState | null
    if (!state?.prefillItems) return

    appliedPrefillRef.current = true

    if (state.prefillCustomerId) {
      const customer = customers.find((c) => c.id === state.prefillCustomerId)
      if (customer) setSelectedCustomer(customer)
    }
    if (state.prefillNote) setNote(state.prefillNote)

    const lines: CartLine[] = []
    let missing = 0
    state.prefillItems.forEach((item) => {
      const variant = variants.find((v) => v.id === item.variant_id)
      if (variant) lines.push({ variant, qty: item.qty })
      else missing++
    })

    setCart(lines)
    setPrefillMissingCount(missing)
    setPrefillNotice(true)
  }, [loading, variants, customers, location.state])

  function addToCart(variant: VariantWithContext) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id)
      if (existing) {
        return prev.map((l) => (l.variant.id === variant.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { variant, qty: 1 }]
    })
  }

  const cartQtyByVariantId = useMemo(() => {
    const map = new Map<string, number>()
    cart.forEach((l) => map.set(l.variant.id, l.qty))
    return map
  }, [cart])

  function updateQty(variantId: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.variant.id === variantId ? { ...l, qty: Math.max(1, qty) } : l)))
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variant.id !== variantId))
  }

  async function saveCustomer(values: CustomerDialogValues) {
    setCustomerSaving(true)
    setCustomerError(null)
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: values.name, phone: values.phone || null, note: values.note || null })
      .select()
      .single()

    setCustomerSaving(false)
    if (error) {
      setCustomerError(error.message)
      return
    }

    const created = data as Customer
    setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedCustomer(created)
    setCustomerDialogOpen(false)
    setCustomerSheetOpen(false)
  }

  // Discount is never automatic — it only applies once "Apply discount" is clicked, and
  // reads whatever each variant's type default_discount currently is at that moment (no
  // per-sale override, per the spec). Derived from cart qty rather than frozen per line,
  // so it stays correct if a quantity changes after the button is clicked.
  function lineDiscount(line: CartLine): number {
    return discountApplied ? line.variant.default_discount * line.qty : 0
  }

  function lineTotal(line: CartLine): number {
    return line.qty * line.variant.unit_price - lineDiscount(line)
  }

  function handleApplyDiscount() {
    setDiscountApplied(true)
  }

  function handleRemoveDiscount() {
    setDiscountApplied(false)
  }

  const totalDiscount = cart.reduce((sum, l) => sum + lineDiscount(l), 0)
  const total = cart.reduce((sum, l) => sum + lineTotal(l), 0)
  const amountPaidPaise = parseRupeesToPaise(amountPaid || '0')
  const balanceDue = Math.max(total - amountPaidPaise, 0)
  const valid = cart.length > 0 && cart.every((l) => l.qty > 0)

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    setSubmitError(null)

    const items = cart.map((l) => ({
      variant_id: l.variant.id,
      qty: l.qty,
      unit_price: l.variant.unit_price,
      item_snapshot: formatVariantLabel(l.variant),
      discount_amount: lineDiscount(l)
    }))

    const { data: saleId, error } = await supabase.rpc('commit_sale', {
      p_customer_id: selectedCustomer?.id ?? null,
      p_items: items,
      p_amount_paid: amountPaidPaise,
      p_note: note.trim() || null,
      p_created_by: createdBy.trim() || null
    })

    if (error) {
      setSubmitting(false)
      setSubmitError(error.message)
      return
    }

    const { data: sale } = await supabase.from('sales').select('receipt_no, total, balance_due').eq('id', saleId).single()

    setSubmitting(false)
    setSuccess(sale ? { receiptNo: sale.receipt_no, total: sale.total, balanceDue: sale.balance_due } : null)
    setReceiptSaleId(saleId)
    setCart([])
    setDiscountApplied(false)
    setSelectedCustomer(null)
    setAmountPaid('')
    setNote('')
    setCreatedBy('')
    void loadAll()
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
          <IconButton
            onClick={() => navigate('/')}
            aria-label="Back to dashboard"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}
          >
            <BackIcon />
          </IconButton>
          <Typography variant="h4">New sale</Typography>
        </Stack>
        <Stack spacing={2}>
          <FormSkeleton fields={1} actionWidth={100} />
          <FormSkeleton fields={3} actionWidth={100} />
          <FormSkeleton fields={2} actionWidth={160} />
        </Stack>
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load: {loadError}
      </Alert>
    )
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
        <IconButton
          onClick={() => navigate('/')}
          aria-label="Back to dashboard"
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}
        >
          <BackIcon />
        </IconButton>
        <Typography variant="h4">New sale</Typography>
      </Stack>

      {prefillNotice && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPrefillNotice(false)}>
          Editing a cancelled sale — review the items below and complete to save as a new sale.
          {prefillMissingCount > 0 &&
            ` ${prefillMissingCount} item(s) from the original sale are no longer available and weren't added back.`}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          Sale {success.receiptNo} recorded — total {formatMoney(success.total)}
          {success.balanceDue > 0 ? `, balance due ${formatMoney(success.balanceDue)}` : ' (paid in full)'}.
        </Alert>
      )}
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box
          onClick={() => setCustomerSheetOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.25,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            cursor: 'pointer'
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selectedCustomer ? selectedCustomer.name : 'Walk-in customer'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tap to choose customer
            </Typography>
          </Box>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        </Box>
      </Paper>

      {topSellers.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Top sellers
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
            {topSellers.map((v) => {
              const cartQty = cartQtyByVariantId.get(v.id) ?? 0
              return (
                <Paper
                  key={v.id}
                  variant="outlined"
                  onClick={() => addToCart(v)}
                  sx={{
                    position: 'relative',
                    p: 1.25,
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderColor: cartQty > 0 ? 'primary.main' : 'divider',
                    bgcolor: cartQty > 0 ? 'rgba(201,122,43,0.1)' : 'background.paper'
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    {v.product_name} · {v.type_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {v.size_label ?? (v.size !== 0 ? formatSize(v.size ?? 0) : ' ')}
                  </Typography>
                  <Typography variant="mono" sx={{ fontSize: '0.7rem', opacity: 0.75, display: 'block' }}>
                    {formatMoney(v.unit_price)}
                  </Typography>
                  {cartQty > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: '#1B1710',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {cartQty}
                    </Box>
                  )}
                </Paper>
              )
            })}
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <ProductTypeSizePicker
          variants={variants}
          onPick={addToCart}
          cartQtyByVariantId={cartQtyByVariantId}
          autoAddSizeless
          resetVariantAfterPick
          layout="dropdown"
        />
      </Paper>

      {cart.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Cart
          </Typography>

          {/* Mobile: stacked cards — a 6-column table doesn't fit a phone width */}
          <Stack spacing={1.5} sx={{ mt: 2, display: { xs: 'flex', sm: 'none' } }}>
            {cart.map((line) => (
              <Paper key={line.variant.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {line.variant.product_name} · {line.variant.type_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {line.variant.size_label
                        ? `${line.variant.size_label} · `
                        : line.variant.size !== 0 && `Size ${formatSize(line.variant.size ?? 0)} · `}
                      {formatMoney(line.variant.unit_price)} each
                    </Typography>
                    {line.qty > line.variant.current_stock && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                        Only {line.variant.current_stock} in stock
                      </Typography>
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => removeLine(line.variant.id)} sx={{ flexShrink: 0 }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                  <QtyStepper qty={line.qty} onChange={(qty) => updateQty(line.variant.id, qty)} />
                  <Box sx={{ textAlign: 'right' }}>
                    {lineDiscount(line) > 0 && (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                        −{formatMoney(lineDiscount(line))} discount
                      </Typography>
                    )}
                    <Typography variant="mono" sx={{ fontWeight: 600 }}>
                      {formatMoney(lineTotal(line))}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>

          {/* Desktop/tablet: table */}
          <Box sx={{ mt: 2, overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  {discountApplied && <TableCell align="right">Discount</TableCell>}
                  <TableCell align="right">Line total</TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.map((line) => (
                  <TableRow key={line.variant.id}>
                    <TableCell>
                      {line.variant.product_name} · {line.variant.type_name}
                      {line.qty > line.variant.current_stock && (
                        <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                          Only {line.variant.current_stock} in stock
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {line.variant.size_label ?? (line.variant.size === 0 ? '' : formatSize(line.variant.size ?? 0))}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(line.variant.unit_price)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <QtyStepper qty={line.qty} onChange={(qty) => updateQty(line.variant.id, qty)} />
                    </TableCell>
                    {discountApplied && (
                      <TableCell align="right">
                        {lineDiscount(line) > 0 ? (
                          <Typography variant="mono" color="success.main">
                            −{formatMoney(lineDiscount(line))}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(lineTotal(line))}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeLine(line.variant.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {cart.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Payment
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              placeholder="Amount received now (Rs.)"
              inputProps={{ 'aria-label': 'Amount received now (Rs.)', step: '0.01', min: 0 }}
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              fullWidth
            />
            <Button
              onClick={() => setAmountPaid(String(total / 100))}
              disabled={total === 0}
              fullWidth
              sx={flatButtonSx}
            >
              Full amount received
            </Button>
            <Typography variant="body2" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>
              Balance due: {formatMoney(balanceDue)}
            </Typography>

            <TextField
              placeholder="Note (optional)"
              inputProps={{ 'aria-label': 'Note' }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              placeholder="Sold by (optional)"
              inputProps={{ 'aria-label': 'Sold by' }}
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              fullWidth
            />
          </Stack>
        </Paper>
      )}

      {/* Sticky bottom bar — replaces the app's bottom tab bar while this page is
          mounted (see Layout.tsx's HIDE_BOTTOM_NAV_ROUTES) so the two never stack. */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (t) => t.zIndex.appBar,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 2,
          pt: 1.5,
          pb: 'calc(12px + env(safe-area-inset-bottom))'
        }}
      >
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
            <Stack direction="row" gap={1}>
              <Button variant="outlined" size="small" onClick={handleApplyDiscount} disabled={discountApplied || cart.length === 0}>
                {discountApplied ? 'Discount applied' : 'Apply discount'}
              </Button>
              {discountApplied && (
                <Button variant="text" size="small" color="error" onClick={handleRemoveDiscount}>
                  Remove
                </Button>
              )}
            </Stack>
            <Box sx={{ textAlign: 'right' }}>
              {totalDiscount > 0 && (
                <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                  −{formatMoney(totalDiscount)} discount
                </Typography>
              )}
              <Typography variant="mono" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {formatMoney(total)}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!valid || submitting}
            onClick={() => void handleSubmit()}
          >
            Complete sale
          </Button>
        </Box>
      </Box>

      <BottomSheet open={customerSheetOpen} onClose={() => setCustomerSheetOpen(false)} title="Choose customer">
        <List sx={{ pt: 0 }}>
          <ListItemButton
            selected={!selectedCustomer}
            onClick={() => {
              setSelectedCustomer(null)
              setCustomerSheetOpen(false)
            }}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemText primary="Walk-in customer" />
            {!selectedCustomer && (
              <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
          </ListItemButton>
          {customers.map((c) => (
            <ListItemButton
              key={c.id}
              selected={selectedCustomer?.id === c.id}
              onClick={() => {
                setSelectedCustomer(c)
                setCustomerSheetOpen(false)
              }}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemText primary={c.name} secondary={c.phone || undefined} />
              {selectedCustomer?.id === c.id && (
                <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
              )}
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={() => {
            setCustomerSheetOpen(false)
            setCustomerDialogOpen(true)
          }}
        >
          New customer
        </Button>
      </BottomSheet>

      <CustomerDialog
        open={customerDialogOpen}
        saving={customerSaving}
        error={customerError}
        onClose={() => {
          setCustomerDialogOpen(false)
          setCustomerError(null)
        }}
        onSave={saveCustomer}
      />

      <ReceiptDialog open={!!receiptSaleId} saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />
    </Box>
  )
}
