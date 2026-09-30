import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { FileDownloadIcon as FileDownloadSharp } from '../components/icons'
import { supabase, formatMoney } from '../lib/supabase'
import { Sale, PaymentStatus } from '../types'
import SaleDetailDialog from '../components/sale/SaleDetailDialog'
import Receipt, { ReceiptData } from '../components/sale/Receipt'
import { fetchReceiptData } from '../lib/receiptData'
import { downloadBlob, receiptToPngBlob } from '../lib/receipt'
import { RowCardsSkeleton } from '../components/skeletons'
import BackButton from '../components/common/BackButton'
import { chipUnselectedBg, listRowSx } from '../theme'

type SaleRow = Sale & { customers: { name: string } | null }

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-IN', { timeStyle: 'short' })

  const now = new Date()
  if (isSameDay(date, now)) return `Today ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday)) return `Yesterday ${time}`

  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

type PaymentFilterValue = PaymentStatus | 'all' | 'paid_late'

const PAYMENT_FILTERS: Array<{ value: PaymentFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid_late', label: 'Paid Late' }
]

// A sale's date and its payments' dates are both stored as UTC timestamptz — slicing to
// just the date portion is enough for a same-day comparison here without timezone math.
function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function saleStatusBadge(sale: SaleRow): { label: string; color: 'success' | 'warning' | 'error' } {
  if (sale.status === 'cancelled') return { label: 'CANCELLED', color: 'error' }
  if (sale.payment_status === 'paid') return { label: 'PAID', color: 'success' }
  return { label: 'PENDING', color: 'warning' }
}

export default function AllSales() {
  const theme = useTheme()
  const unselectedBg = chipUnselectedBg(theme.palette.mode)
  const [searchParams] = useSearchParams()
  const initialPaymentFilter = searchParams.get('filter') === 'pending' ? 'pending' : 'all'

  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showCancelled, setShowCancelled] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterValue>(initialPaymentFilter)
  const [customerFilter, setCustomerFilter] = useState('')
  const [search, setSearch] = useState('')
  // Last payment date per sale_id — a sale counts as "paid late" when this is on a later
  // calendar day than the sale itself (see dateOnly/isPaidLate below).
  const [lastPaymentDateBySale, setLastPaymentDateBySale] = useState<Map<string, string>>(new Map())

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const hiddenReceiptRef = useRef<HTMLDivElement>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [pendingDownload, setPendingDownload] = useState<ReceiptData | null>(null)

  useEffect(() => {
    void loadSales()
  }, [])

  // The receipt is rendered off-screen (below) once pendingDownload is set, then
  // captured here — this effect fires after that render commits, so the DOM node is
  // guaranteed to exist.
  useEffect(() => {
    if (!pendingDownload) return
    let cancelled = false

    void (async () => {
      if (!hiddenReceiptRef.current) return
      try {
        const blob = await receiptToPngBlob(hiddenReceiptRef.current)
        if (!cancelled) downloadBlob(blob, `${pendingDownload.receiptNo}.png`)
      } catch (err) {
        if (!cancelled) setDownloadError(err instanceof Error ? err.message : 'Failed to generate receipt image')
      } finally {
        if (!cancelled) {
          setPendingDownload(null)
          setDownloadingId(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pendingDownload])

  async function handleDownloadRow(e: React.MouseEvent, saleId: string) {
    e.stopPropagation()
    setDownloadingId(saleId)
    setDownloadError(null)
    const { data, error } = await fetchReceiptData(saleId)
    if (error || !data) {
      setDownloadError(error ?? 'Failed to load that sale.')
      setDownloadingId(null)
      return
    }
    setPendingDownload(data)
  }

  async function loadSales() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }

    const salesData = (data ?? []) as unknown as SaleRow[]
    setSales(salesData)

    const saleIds = salesData.map((s) => s.id)
    if (saleIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('sale_id, paid_at')
        .in('sale_id', saleIds)

      if (!paymentsError) {
        const lastPaidAt = new Map<string, string>()
        for (const p of (paymentsData ?? []) as { sale_id: string; paid_at: string }[]) {
          const existing = lastPaidAt.get(p.sale_id)
          if (!existing || p.paid_at > existing) lastPaidAt.set(p.sale_id, p.paid_at)
        }
        setLastPaymentDateBySale(lastPaidAt)
      }
    } else {
      setLastPaymentDateBySale(new Map())
    }

    setLoading(false)
  }

  // Only a sale that's currently fully paid and still active can be "late" — a sale still
  // pending (no payment yet, or not enough to cover it) isn't late, it's just unpaid.
  function isPaidLate(sale: SaleRow): boolean {
    if (sale.status !== 'active' || sale.payment_status !== 'paid') return false
    const lastPaidAt = lastPaymentDateBySale.get(sale.id)
    if (!lastPaidAt) return false
    return dateOnly(lastPaidAt) > dateOnly(sale.created_at)
  }

  // "Paid 5hr late" under a day, "Paid 1d 5hr late" (hour part omitted when exactly on a
  // day boundary) at or beyond a day — actual elapsed time between sale and last payment,
  // not the calendar-day gap isPaidLate uses to decide eligibility in the first place.
  function formatLateDuration(sale: SaleRow): string | null {
    const lastPaidAt = lastPaymentDateBySale.get(sale.id)
    if (!lastPaidAt) return null
    const diffMs = new Date(lastPaidAt).getTime() - new Date(sale.created_at).getTime()
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (totalHours < 1) return 'Paid <1hr late'
    if (totalHours < 24) return `Paid ${totalHours}hr late`
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return hours > 0 ? `Paid ${days}d ${hours}hr late` : `Paid ${days}d late`
  }

  const customerOptions = useMemo(() => {
    const names = new Set(sales.map((s) => s.customers?.name ?? 'Walk-in'))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [sales])

  const searchLower = search.trim().toLowerCase()
  const visibleSales = sales.filter((s) => {
    if (!showCancelled && s.status === 'cancelled') return false
    if (paymentFilter === 'paid_late') {
      if (!isPaidLate(s)) return false
    } else if (paymentFilter !== 'all' && s.payment_status !== paymentFilter) {
      return false
    }
    if (customerFilter && (s.customers?.name ?? 'Walk-in') !== customerFilter) return false
    if (searchLower) {
      const matchesReceipt = s.receipt_no.toLowerCase().includes(searchLower)
      const matchesCustomer = (s.customers?.name ?? '').toLowerCase().includes(searchLower)
      if (!matchesReceipt && !matchesCustomer) return false
    }
    return true
  })

  if (loading) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <BackButton />
          <Typography variant="h4">All sales</Typography>
        </Stack>
        <RowCardsSkeleton rows={6} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <BackButton />
          <Typography variant="h4">All sales</Typography>
        </Stack>
        <Alert severity="error">Failed to load sales: {loadError}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <BackButton />
        <Typography variant="h4">All sales</Typography>
      </Stack>

      <Paper sx={{ border: '1px solid', borderColor: 'divider', p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            placeholder="Search receipt or customer"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'aria-label': 'Search receipt or customer' }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              select
              label="Customer"
              size="small"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              sx={{ minWidth: { sm: 180 } }}
            >
              <MenuItem value="">All</MenuItem>
              {customerOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {PAYMENT_FILTERS.map((f) => {
                const isSelected = f.value === paymentFilter
                return (
                  <Chip
                    key={f.value}
                    label={f.label}
                    clickable
                    onClick={() => setPaymentFilter(f.value)}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color="primary"
                    sx={isSelected ? undefined : { bgcolor: unselectedBg }}
                  />
                )
              })}
            </Stack>
            <FormControlLabel
              sx={{ mx: 0, flexShrink: 0 }}
              control={<Switch checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />}
              label="Show cancelled"
            />
          </Stack>
        </Stack>
      </Paper>

      {downloadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownloadError(null)}>
          {downloadError}
        </Alert>
      )}

      {visibleSales.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">No sales match these filters.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {visibleSales.map((sale) => {
            const badge = saleStatusBadge(sale)
            return (
              <Box
                key={sale.id}
                onClick={() => setSelectedSaleId(sale.id)}
                sx={{
                  ...listRowSx(theme),
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0.5,
                  cursor: 'pointer',
                  opacity: sale.status === 'cancelled' ? 0.6 : 1
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, flex: 1 }} noWrap>
                    {sale.customers?.name ?? 'Walk-in'}
                  </Typography>
                  <Typography variant="mono" sx={{ flexShrink: 0 }}>
                    {formatMoney(sale.total)}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                      {sale.receipt_no}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                      {formatDateTime(sale.created_at)}
                    </Typography>
                    {isPaidLate(sale) && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                        {formatLateDuration(sale)}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
                    {sale.balance_due > 0 && (
                      <Typography variant="mono" color="warning.main" sx={{ fontSize: '0.7rem' }} noWrap>
                        Bal {formatMoney(sale.balance_due)}
                      </Typography>
                    )}
                    <Chip size="small" label={badge.label} color={badge.color} sx={{ fontSize: '0.65rem' }} />
                    <IconButton
                      size="small"
                      disabled={downloadingId === sale.id}
                      onClick={(e) => void handleDownloadRow(e, sale.id)}
                      aria-label="Download receipt"
                    >
                      {downloadingId === sale.id ? <CircularProgress size={16} /> : <FileDownloadSharp fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            )
          })}
        </Stack>
      )}

      {pendingDownload && (
        <Box sx={{ position: 'fixed', top: 0, left: -9999, zIndex: -1 }} aria-hidden>
          <Receipt ref={hiddenReceiptRef} data={pendingDownload} />
        </Box>
      )}

      <SaleDetailDialog
        open={!!selectedSaleId}
        saleId={selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
        onChanged={() => void loadSales()}
      />
    </Box>
  )
}
