import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  TextField,
  Alert,
  Button,
  Tabs,
  Tab,
  IconButton
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreSharp'
import ExpandLessIcon from '@mui/icons-material/ExpandLessSharp'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardSharp'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardSharp'
import { FileDownloadIcon as PictureAsPdfIcon } from '../components/icons'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { useTheme } from '@mui/material/styles'
import { supabase, formatMoney } from '../lib/supabase'
import { downloadBlob, receiptToPdfBlob } from '../lib/receipt'
import { chipUnselectedBg, listRowSx } from '../theme'
import { SummaryCardsSkeleton, ChartSkeleton, TableSkeleton } from '../components/skeletons'
import { Sale, SaleItem } from '../types'

type Preset = 'today' | '7d' | 'month' | 'all' | 'custom'
type ReportTab = 'overview' | 'customer' | 'product' | 'list'
type SortDir = 'asc' | 'desc'

// `customers(name)` embed, same pattern AllSales.tsx uses — cheaper than a separate
// customers fetch + client-side join since PostgREST does it in one round trip.
type SaleRow = Sale & { customers: { name: string } | null }

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' }
]

const TABS: { value: ReportTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'customer', label: 'By customer' },
  { value: 'product', label: 'By product' },
  { value: 'list', label: 'Sales list' }
]

// On-screen default for the top-items list — the full top 10 (see `topItems` below) is
// always rendered inside `reportRef`; this only controls how many rows are visible before
// "See all" is clicked. Kept separate from the PDF export path, which forces all 10 rows
// visible for the duration of the capture regardless of this collapsed/expanded UI state.
const COLLAPSED_ITEM_COUNT = 4

interface ItemAgg {
  label: string
  qty: number
  revenue: number
}

interface CustomerAgg {
  key: string
  name: string
  saleCount: number
  totalAmount: number
  balanceDue: number
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

function aggregateByCustomer(sales: SaleRow[]): CustomerAgg[] {
  const map = new Map<string, CustomerAgg>()
  sales.forEach((s) => {
    const key = s.customer_id ?? 'walkin'
    const existing = map.get(key)
    if (existing) {
      existing.saleCount += 1
      existing.totalAmount += s.total
      existing.balanceDue += s.balance_due
    } else {
      map.set(key, {
        key,
        name: s.customers?.name ?? 'Walk-in',
        saleCount: 1,
        totalAmount: s.total,
        balanceDue: s.balance_due
      })
    }
  })
  return Array.from(map.values())
}

function paymentBadge(sale: Sale): { label: string; color: 'success' | 'warning' | 'error' } {
  if (sale.status === 'cancelled') return { label: 'CANCELLED', color: 'error' }
  if (sale.payment_status === 'paid') return { label: 'PAID', color: 'success' }
  return { label: 'PENDING', color: 'warning' }
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

// Waits two animation frames — one for React to commit the DOM update from a state
// change, one for the browser to paint it — before the caller proceeds. Used only by the
// PDF export flow below to make sure the "show all" layout has actually landed before
// html2canvas snapshots the report container.
function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export default function SalesReport() {
  const theme = useTheme()
  const unselectedChipBg = chipUnselectedBg(theme.palette.mode)
  const [tab, setTab] = useState<ReportTab>('overview')
  const [preset, setPreset] = useState<Preset>('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [sales, setSales] = useState<SaleRow[]>([])
  const [items, setItems] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('MIG')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  // Controls whether the top-items list shows all 10 rows or just the first
  // COLLAPSED_ITEM_COUNT. All 10 rows are always present in the DOM inside `reportRef` —
  // this only toggles a `display: none` on the extra rows — so `handleExportPdf` can
  // temporarily flip it to true to guarantee the export captures the full top 10 even
  // when the on-screen view is collapsed. Only relevant to the Overview tab.
  const [itemsExpanded, setItemsExpanded] = useState(false)
  const [customerSortDir, setCustomerSortDir] = useState<SortDir>('desc')
  const [productSortDir, setProductSortDir] = useState<SortDir>('desc')
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
    const wasExpanded = itemsExpanded
    try {
      // Force the full top-10 list visible for the capture, regardless of the collapsed
      // on-screen state — the PDF must always include all 10 rows, not just the 4 shown
      // by default. Restored in `finally` below so the user's on-screen view is untouched.
      // Only applies to the Overview tab — the other tabs render their full list already.
      if (tab === 'overview' && !wasExpanded) {
        setItemsExpanded(true)
        await waitForNextPaint()
      }
      const blob = await receiptToPdfBlob(reportRef.current)
      const rangeSlug = presetLabel(preset, fromDate, toDate).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const tabSlug = (TABS.find((t) => t.value === tab)?.label ?? tab).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      downloadBlob(blob, `${companyName}-sales-report-${tabSlug}-${rangeSlug}.pdf`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to generate report PDF')
    } finally {
      if (tab === 'overview' && !wasExpanded) setItemsExpanded(false)
      setExporting(false)
    }
  }

  async function loadReport() {
    setLoading(true)
    setLoadError(null)

    const { from, to } = rangeForPreset(preset, fromDate, toDate)

    let query = supabase
      .from('sales')
      .select('*, customers(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (from) query = query.gte('created_at', from.toISOString())
    if (to) query = query.lte('created_at', to.toISOString())

    const { data: salesData, error: salesError } = await query
    if (salesError) {
      setLoadError(salesError.message)
      setLoading(false)
      return
    }

    const salesList = (salesData ?? []) as SaleRow[]
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
  const avgSaleValue = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0
  const trend = buildTrend(sales, from, to)
  const allItems = aggregateItems(items)
  const topItems = allItems.slice(0, 10)
  const otherItemsCount = allItems.length - topItems.length

  const customerRows = useMemo(() => {
    const rows = aggregateByCustomer(sales)
    rows.sort((a, b) => (customerSortDir === 'desc' ? b.totalAmount - a.totalAmount : a.totalAmount - b.totalAmount))
    return rows
  }, [sales, customerSortDir])

  const productRows = useMemo(() => {
    const rows = [...allItems]
    rows.sort((a, b) => (productSortDir === 'desc' ? b.qty - a.qty : a.qty - b.qty))
    return rows
  }, [allItems, productSortDir])

  const itemCountBySale = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((it) => map.set(it.sale_id, (map.get(it.sale_id) ?? 0) + it.qty))
    return map
  }, [items])

  const listRows = useMemo(
    () => [...sales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sales]
  )

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Sales report
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: ReportTab) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider', minHeight: 40 }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} sx={{ minHeight: 40 }} />
        ))}
      </Tabs>

      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {PRESETS.map((p) => {
              const isSelected = p.value === preset
              return (
                <Chip
                  key={p.value}
                  label={p.label}
                  clickable
                  onClick={() => setPreset(p.value)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  color="primary"
                  sx={{ flexShrink: 0, ...(isSelected ? {} : { bgcolor: unselectedChipBg }) }}
                />
              )
            })}
          </Stack>

          {preset === 'custom' && (
            <>
              <TextField
                placeholder="From"
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                inputProps={{ 'aria-label': 'From' }}
              />
              <TextField
                placeholder="To"
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                inputProps={{ 'aria-label': 'To' }}
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
          <SummaryCardsSkeleton count={5} />
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
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No sales in this period.</Typography>
        </Paper>
      )}

      {!loading && !loadError && sales.length > 0 && (
        <Box ref={reportRef} sx={{ p: 1, bgcolor: 'background.default' }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h5">{companyName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {TABS.find((t) => t.value === tab)?.label} — {presetLabel(preset, fromDate, toDate)} — generated{' '}
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>

          {tab === 'overview' && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
                  gap: 1.5,
                  mb: 3
                }}
              >
                <SummaryCard label="Revenue" value={formatMoney(totalRevenue)} />
                <SummaryCard label="Sales" value={String(sales.length)} />
                <SummaryCard label="Avg sale" value={formatMoney(avgSaleValue)} />
                <SummaryCard label="Collected" value={formatMoney(totalCollected)} />
                <SummaryCard label="Pending" value={formatMoney(totalPending)} accent={totalPending > 0} />
              </Box>

              <Paper sx={{ p: 2, mb: 3 }}>
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
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString('en-IN')}`, 'Revenue']} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        fill="url(#reportTrendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1">Top selling items</Typography>
                {topItems.length > COLLAPSED_ITEM_COUNT && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setItemsExpanded((v) => !v)}
                    endIcon={itemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {itemsExpanded ? 'Show less' : `See all ${topItems.length}`}
                  </Button>
                )}
              </Stack>

              <Stack spacing={1}>
                {/*
                  All 10 top items are always rendered here (never conditionally skipped) so
                  that `reportRef` — the element handleExportPdf hands to receiptToPdfBlob —
                  contains the full list on export. Rows beyond COLLAPSED_ITEM_COUNT are only
                  hidden via `display: none` while collapsed; handleExportPdf flips
                  `itemsExpanded` to true before capturing so nothing is missing from the PDF.
                */}
                {topItems.map((item, idx) => (
                  <Box
                    key={item.label}
                    sx={{
                      ...listRowSx(theme),
                      display: idx < COLLAPSED_ITEM_COUNT || itemsExpanded ? 'flex' : 'none'
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {item.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.qty} sold
                      </Typography>
                    </Box>
                    <Typography variant="mono" sx={{ fontWeight: 700, flexShrink: 0 }}>
                      {formatMoney(item.revenue)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              {otherItemsCount > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  +{otherItemsCount} more item{otherItemsCount === 1 ? '' : 's'} not shown.
                </Typography>
              )}
            </>
          )}

          {tab === 'customer' && (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1">Sales by customer</Typography>
                <IconButton
                  size="small"
                  onClick={() => setCustomerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={customerSortDir === 'asc' ? 'Sort amount ascending' : 'Sort amount descending'}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                >
                  {customerSortDir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                </IconButton>
              </Stack>
              {customerRows.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                  <Typography color="text.secondary">No customer sales in this period.</Typography>
                </Paper>
              ) : (
                <Stack spacing={1}>
                  {customerRows.map((row) => (
                    <Box key={row.key} sx={listRowSx(theme)}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.saleCount} sale{row.saleCount === 1 ? '' : 's'}
                          {row.balanceDue > 0 ? ` · Bal ${formatMoney(row.balanceDue)}` : ''}
                        </Typography>
                      </Box>
                      <Typography variant="mono" sx={{ fontWeight: 700, flexShrink: 0 }}>
                        {formatMoney(row.totalAmount)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}

          {tab === 'product' && (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1">Sales by product</Typography>
                <IconButton
                  size="small"
                  onClick={() => setProductSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={productSortDir === 'asc' ? 'Sort quantity ascending' : 'Sort quantity descending'}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                >
                  {productSortDir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                </IconButton>
              </Stack>
              {productRows.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                  <Typography color="text.secondary">No products sold in this period.</Typography>
                </Paper>
              ) : (
                <Stack spacing={1}>
                  {productRows.map((item) => (
                    <Box key={item.label} sx={listRowSx(theme)}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMoney(item.revenue)} revenue
                        </Typography>
                      </Box>
                      <Typography variant="mono" sx={{ fontWeight: 700, flexShrink: 0 }}>
                        {item.qty} sold
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}

          {tab === 'list' && (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                Sales list
              </Typography>
              <Stack spacing={1}>
                {listRows.map((sale) => {
                  const badge = paymentBadge(sale)
                  const count = itemCountBySale.get(sale.id) ?? 0
                  return (
                    <Box key={sale.id} sx={{ ...listRowSx(theme), opacity: sale.status === 'cancelled' ? 0.6 : 1 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {sale.customers?.name ?? 'Walk-in'} · {sale.receipt_no.replace(/^MIG[_-]/, '')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(sale.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}{' '}
                          · {count} item{count === 1 ? '' : 's'}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" gap={0.5} sx={{ flexShrink: 0 }}>
                        <Typography variant="mono" sx={{ fontWeight: 700 }}>
                          {formatMoney(sale.total)}
                        </Typography>
                        <Chip size="small" label={badge.label} color={badge.color} sx={{ fontSize: '0.65rem' }} />
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Paper sx={{ p: 1.5, height: '100%' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="mono" color={accent ? 'warning.main' : 'text.primary'} sx={{ fontSize: 22, display: 'block', mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  )
}
