import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
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
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded'
import { supabase, formatMoney } from '../lib/supabase'
import { Sale, PaymentStatus } from '../types'
import SaleDetailDialog from '../components/sale/SaleDetailDialog'
import Receipt, { ReceiptData } from '../components/sale/Receipt'
import { fetchReceiptData } from '../lib/receiptData'
import { downloadBlob, receiptToPngBlob } from '../lib/receipt'

type SaleRow = Sale & { customers: { name: string } | null }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AllSales() {
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load sales: {loadError}
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        All sales
      </Typography>

      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Search receipt or customer"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <TextField
          select
          label="Payment"
          size="small"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'all')}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
        </TextField>
        <FormControlLabel
          control={<Switch checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />}
          label="Show cancelled"
        />
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
        <>
          {/* Mobile: stacked cards — an 8-column table doesn't fit a phone width */}
          <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
            {visibleSales.map((sale) => (
              <Paper
                key={sale.id}
                variant="outlined"
                onClick={() => setSelectedSaleId(sale.id)}
                sx={{ p: 1.5, cursor: 'pointer', opacity: sale.status === 'cancelled' ? 0.6 : 1 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {sale.receipt_no}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(sale.created_at)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    disabled={downloadingId === sale.id}
                    onClick={(e) => void handleDownloadRow(e, sale.id)}
                    aria-label="Download receipt"
                    sx={{ flexShrink: 0 }}
                  >
                    {downloadingId === sale.id ? <CircularProgress size={16} /> : <FileDownloadRounded fontSize="small" />}
                  </IconButton>
                </Stack>

                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {sale.customers?.name ?? 'Walk-in'}
                </Typography>

                <Stack direction="row" gap={0.75} sx={{ mt: 1 }}>
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

                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                  <Typography variant="mono">{formatMoney(sale.total)}</Typography>
                </Stack>
                {sale.balance_due > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Balance due
                    </Typography>
                    <Typography variant="mono" color="warning.main">
                      {formatMoney(sale.balance_due)}
                    </Typography>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>

          {/* Desktop/tablet: table */}
          <Paper sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Receipt</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Balance due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    hover
                    onClick={() => setSelectedSaleId(sale.id)}
                    sx={{ cursor: 'pointer', opacity: sale.status === 'cancelled' ? 0.6 : 1 }}
                  >
                    <TableCell>{sale.receipt_no}</TableCell>
                    <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                    <TableCell>{sale.customers?.name ?? 'Walk-in'}</TableCell>
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(sale.total)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="mono" color={sale.balance_due > 0 ? 'warning.main' : 'text.primary'}>
                        {formatMoney(sale.balance_due)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={sale.status === 'active' ? 'Active' : 'Cancelled'}
                        color={sale.status === 'active' ? 'default' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={sale.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        color={sale.payment_status === 'paid' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        disabled={downloadingId === sale.id}
                        onClick={(e) => void handleDownloadRow(e, sale.id)}
                        aria-label="Download receipt"
                      >
                        {downloadingId === sale.id ? <CircularProgress size={16} /> : <FileDownloadRounded fontSize="small" />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
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
