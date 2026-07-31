import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Button
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfSharp'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { useTheme } from '@mui/material/styles'
import { supabase, formatMoney } from '../lib/supabase'
import { downloadBlob, receiptToPdfBlob } from '../lib/receipt'
import { SummaryCardsSkeleton, ChartSkeleton, TableSkeleton } from '../components/skeletons'
import { Sale, SaleItem } from '../types'

type Preset = 'today' | '7d' | 'month' | 'all' | 'custom'

interface ItemAgg {
  label: string
  qty: number
  revenue: number
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function rangeForPreset(preset: Preset, fromDate: string, toDate: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case '7d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 6)
      return { from: startOfDay(from), to: endOfDay(now) }
    }
    case 'month':
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) }
    case 'custom':
      return {
        from: fromDate ? startOfDay(new Date(fromDate)) : null,
        to: toDate ? endOfDay(new Date(toDate)) : null
      }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

function presetLabel(preset: Preset, fromDate: string, toDate: string): string {
  switch (preset) {
    case 'today':
      return 'Today'
    case '7d':
      return 'Last 7 days'
    case 'month':
      return 'This month'
    case 'custom':
      return fromDate && toDate ? `${fromDate} to ${toDate}` : 'Custom range'
    case 'all':
    default:
      return 'All time'
  }
}

function aggregateItems(items: SaleItem[]): ItemAgg[] {
  const map = new Map<string, ItemAgg>()
  items.forEach((it) => {
    const existing = map.get(it.item_snapshot)
    if (existing) {
      existing.qty += it.qty
      existing.revenue += it.line_total
    } else {
      map.set(it.item_snapshot, { label: it.item_snapshot, qty: it.qty, revenue: it.line_total })
    }
  })
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

function buildTrend(sales: Sale[], from: Date | null, to: Date | null): { label: string; total: number }[] {
  if (sales.length === 0) return []

  const effectiveFrom = from ?? new Date(sales[0].created_at)
  const effectiveTo = to ?? new Date()
  const spanDays = Math.max(1, Math.ceil((effectiveTo.getTime() - effectiveFrom.getTime()) / 86400000))
  const monthly = spanDays > 60

  const buckets = new Map<string, number>()
  sales.forEach((s) => {
    const d = new Date(s.created_at)
    const key = monthly
      ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    buckets.set(key, (buckets.get(key) ?? 0) + s.total)
  })

  return Array.from(buckets, ([label, total]) => ({ label, total: total / 100 }))
}

export default function SalesReport() {
  const theme = useTheme()
  const [preset, setPreset] = useState<Preset>('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [sales, setSales] = useState<Sale[]>([])
  const [items, setItems] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('MIG')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadReport()
  }, [preset, fromDate, toDate])

  useEffect(() => {
    void supabase
      .from('settings')
      .select('company_name')
      .eq('id', 1)
      .single()
      .then(({ data }) => data?.company_name && setCompanyName(data.company_name))
  }, [])

  async function handleExportPdf() {
    if (!reportRef.current) return
    setExporting(true)
    setExportError(null)
    try {
      const blob = await receiptToPdfBlob(reportRef.current)
      const rangeSlug = presetLabel(preset, fromDate, toDate).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      downloadBlob(blob, `${companyName}-sales-report-${rangeSlug}.pdf`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to generate report PDF')
    }
    setExporting(false)
  }

  async function loadReport() {
    setLoading(true)
    setLoadError(null)

    const { from, to } = rangeForPreset(preset, fromDate, toDate)

    let query = supabase.from('sales').select('*').eq('status', 'active').order('created_at', { ascending: true })
    if (from) query = query.gte('created_at', from.toISOString())
    if (to) query = query.lte('created_at', to.toISOString())

    const { data: salesData, error: salesError } = await query
    if (salesError) {
      setLoadError(salesError.message)
      setLoading(false)
      return
    }

    const salesList = (salesData ?? []) as Sale[]
    const saleIds = salesList.map((s) => s.id)

    let itemsList: SaleItem[] = []
    if (saleIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase.from('sale_items').select('*').in('sale_id', saleIds)
      if (itemsError) {
        setLoadError(itemsError.message)
        setLoading(false)
        return
      }
      itemsList = (itemsData ?? []) as SaleItem[]
    }

    setSales(salesList)
    setItems(itemsList)
    setLoading(false)
  }

  const { from, to } = rangeForPreset(preset, fromDate, toDate)
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const totalCollected = sales.reduce((sum, s) => sum + s.amount_paid, 0)
  const totalPending = sales.reduce((sum, s) => sum + s.balance_due, 0)
  const trend = buildTrend(sales, from, to)
  const allItems = aggregateItems(items)
  const topItems = allItems.slice(0, 10)
  const otherItemsCount = allItems.length - topItems.length

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Sales report
      </Typography>

      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={preset}
            exclusive
            onChange={(_, value) => value && setPreset(value)}
          >
            <ToggleButton value="today">Today</ToggleButton>
            <ToggleButton value="7d">Last 7 days</ToggleButton>
            <ToggleButton value="month">This month</ToggleButton>
            <ToggleButton value="all">All time</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          {preset === 'custom' && (
            <>
              <TextField
                label="From"
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </Stack>

        <Button
          size="small"
          startIcon={<PictureAsPdfIcon />}
          disabled={loading || !!loadError || sales.length === 0 || exporting}
          onClick={() => void handleExportPdf()}
        >
          {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </Stack>

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {loading && (
        <>
          <SummaryCardsSkeleton count={4} />
          <ChartSkeleton height={200} />
          <TableSkeleton rows={6} columns={3} />
        </>
      )}

      {!loading && loadError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load report: {loadError}
        </Alert>
      )}

      {!loading && !loadError && sales.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">No sales in this period.</Typography>
        </Paper>
      )}

      {!loading && !loadError && sales.length > 0 && (
        <Box ref={reportRef} sx={{ p: 1, bgcolor: 'background.default' }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h5">{companyName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Sales report — {presetLabel(preset, fromDate, toDate)} — generated{' '}
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>

          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Revenue" value={formatMoney(totalRevenue)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Sales" value={String(sales.length)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Collected" value={formatMoney(totalCollected)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Pending" value={formatMoney(totalPending)} accent={totalPending > 0} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Revenue (Rs.)
            </Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Area type="monotone" dataKey="total" stroke={theme.palette.primary.main} strokeWidth={2} fill="url(#reportTrendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Top selling items
          </Typography>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty sold</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topItems.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell align="right">{item.qty}</TableCell>
                    <TableCell align="right">
                      <Typography variant="mono">{formatMoney(item.revenue)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          {otherItemsCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              +{otherItemsCount} more item{otherItemsCount === 1 ? '' : 's'} not shown.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="mono" color={accent ? 'warning.main' : 'text.primary'} sx={{ fontSize: 22, display: 'block', mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  )
}
