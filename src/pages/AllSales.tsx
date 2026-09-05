import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  TextField,
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

const PAYMENT_FILTERS: Array<{ value: PaymentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' }
]

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
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>(initialPaymentFilter)
  const [search, setSearch] = useState('')

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

    if (error) setLoadError(error.message)
    else setSales((data ?? []) as unknown as SaleRow[])
    setLoading(false)
  }

  const searchLower = search.trim().toLowerCase()
  const visibleSales = sales.filter((s) => {
    if (!showCancelled && s.status === 'cancelled') return false
    if (paymentFilter !== 'all' && s.payment_status !== paymentFilter) return false
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

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search receipt or customer"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'aria-label': 'Search receipt or customer' }}
          sx={{ maxWidth: 320 }}
        />
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1}>
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
            control={<Switch checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />}
            label="Show cancelled"
          />
        </Stack>
      </Stack>

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
