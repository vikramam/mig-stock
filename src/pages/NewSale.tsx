import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Autocomplete,
  TextField,
  MenuItem,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Divider
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import PersonAddIcon from '@mui/icons-material/PersonAddAltRounded'
import { supabase, formatMoney, parseRupeesToPaise, fetchActiveVariants } from '../lib/supabase'
import { Customer, VariantWithContext, formatVariantLabel, formatWidth, formatSize } from '../types'
import CustomerDialog, { CustomerDialogValues } from '../components/sale/CustomerDialog'
import ReceiptDialog from '../components/sale/ReceiptDialog'
import QtyStepper from '../components/QtyStepper'

interface CartLine {
  variant: VariantWithContext
  qty: number
}

interface EditPrefillState {
  prefillCustomerId?: string | null
  prefillNote?: string | null
  prefillItems?: { variant_id: string; qty: number }[]
}

export default function NewSale() {
  const location = useLocation()
  const appliedPrefillRef = useRef(false)
  const [prefillNotice, setPrefillNotice] = useState(false)
  const [prefillMissingCount, setPrefillMissingCount] = useState(0)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [variants, setVariants] = useState<VariantWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)

  const [pickProductId, setPickProductId] = useState('')
  const [pickTypeId, setPickTypeId] = useState('')
  const [pickVariantId, setPickVariantId] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

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
    const [{ data: customersData, error: customersError }, { data: variantsData, error: variantsError }] =
      await Promise.all([supabase.from('customers').select('*').order('name', { ascending: true }), fetchActiveVariants()])

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

  const productOptions = useMemo(() => {
    const map = new Map<string, string>()
    variants.forEach((v) => {
      if (!map.has(v.product_id)) map.set(v.product_id, v.product_name)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [variants])

  const typeOptions = useMemo(() => {
    if (!pickProductId) return []
    const map = new Map<string, { id: string; label: string }>()
    variants
      .filter((v) => v.product_id === pickProductId)
      .forEach((v) => {
        if (!map.has(v.type_id)) map.set(v.type_id, { id: v.type_id, label: `${v.type_name} · ${formatWidth(v.width)}` })
      })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [variants, pickProductId])

  const sizeOptions = useMemo(() => {
    if (!pickTypeId) return []
    return variants.filter((v) => v.type_id === pickTypeId).sort((a, b) => a.size - b.size)
  }, [variants, pickTypeId])

  function addToCart(variant: VariantWithContext) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id)
      if (existing) {
        return prev.map((l) => (l.variant.id === variant.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { variant, qty: 1 }]
    })
  }

  function handleProductPick(id: string) {
    setPickProductId(id)
    setPickTypeId('')
    setPickVariantId('')
  }

  function handleTypePick(id: string) {
    setPickTypeId(id)
    setPickVariantId('')
  }

  function handleSizePick(id: string) {
    setPickVariantId(id)
    const variant = sizeOptions.find((v) => v.id === id)
    if (variant) {
      addToCart(variant)
      setPickVariantId('')
    }
  }

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
  }

  const total = cart.reduce((sum, l) => sum + l.qty * l.variant.unit_price, 0)
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
      item_snapshot: formatVariantLabel(l.variant)
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
    setSelectedCustomer(null)
    setPickProductId('')
    setPickTypeId('')
    setPickVariantId('')
    setAmountPaid('')
    setNote('')
    setCreatedBy('')
    void loadAll()
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
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
      <Typography variant="h4" sx={{ mb: 3 }}>
        New sale
      </Typography>

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
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Customer
        </Typography>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Autocomplete
            sx={{ flex: 1 }}
            options={customers}
            getOptionLabel={(c) => `${c.name}${c.phone ? ` · ${c.phone}` : ''}`}
            value={selectedCustomer}
            onChange={(_, value) => setSelectedCustomer(value)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Customer (optional)" placeholder="Walk-in customer" />}
          />
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setCustomerDialogOpen(true)} sx={{ mt: 0.25 }}>
            New
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Items
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
          <TextField select label="Product" value={pickProductId} onChange={(e) => handleProductPick(e.target.value)} fullWidth>
            {productOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Type"
            value={pickTypeId}
            onChange={(e) => handleTypePick(e.target.value)}
            disabled={!pickProductId}
            fullWidth
          >
            {typeOptions.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Size"
            value={pickVariantId}
            onChange={(e) => handleSizePick(e.target.value)}
            disabled={!pickTypeId}
            fullWidth
          >
            {sizeOptions.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {formatSize(v.size)} — {formatMoney(v.unit_price)} · {v.current_stock} in stock
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {cart.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No items added yet.
          </Typography>
        ) : (
          <>
            {/* Mobile: stacked cards — a 6-column table doesn't fit a phone width */}
            <Stack spacing={1.5} sx={{ mt: 2, display: { xs: 'flex', sm: 'none' } }}>
              {cart.map((line) => (
                <Paper key={line.variant.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {line.variant.product_name} · {line.variant.type_name} {formatWidth(line.variant.width)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Size {formatSize(line.variant.size)} · {formatMoney(line.variant.unit_price)} each
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
                    <Typography variant="mono" sx={{ fontWeight: 600 }}>
                      {formatMoney(line.qty * line.variant.unit_price)}
                    </Typography>
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
                    <TableCell align="right">Line total</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((line) => (
                    <TableRow key={line.variant.id}>
                      <TableCell>
                        {line.variant.product_name} · {line.variant.type_name} {formatWidth(line.variant.width)}
                        {line.qty > line.variant.current_stock && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                            Only {line.variant.current_stock} in stock
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatSize(line.variant.size)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="mono">{formatMoney(line.variant.unit_price)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <QtyStepper qty={line.qty} onChange={(qty) => updateQty(line.variant.id, qty)} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="mono">{formatMoney(line.qty * line.variant.unit_price)}</Typography>
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
          </>
        )}

        {cart.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" justifyContent="flex-end">
              <Typography variant="subtitle1">Total: {formatMoney(total)}</Typography>
            </Stack>
          </>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Payment
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              label="Amount received now (Rs.)"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              fullWidth
            />
            <Button variant="text" onClick={() => setAmountPaid(String(total / 100))} disabled={total === 0}>
              Full amount
            </Button>
          </Stack>
          <Typography variant="body2" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>
            Balance due: {formatMoney(balanceDue)}
          </Typography>

          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />

          <TextField
            label="Sold by (optional)"
            placeholder="e.g. owner, father"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            fullWidth
          />

          <Button variant="contained" size="large" disabled={!valid || submitting} onClick={() => void handleSubmit()}>
            Complete sale
          </Button>
        </Stack>
      </Paper>

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
