import { useEffect, useState } from 'react'
import { Box, Grid, Paper, Typography, Chip, Stack } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { SellIcon, InventoryIcon, PeopleIcon, WarningIcon, BarChartIcon, SmartToyIcon, ClipboardListIcon } from '../components/icons'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongSharp'
import PaymentsIcon from '@mui/icons-material/PaymentsSharp'
import TrendingUpIcon from '@mui/icons-material/TrendingUpSharp'
import TrendingDownIcon from '@mui/icons-material/TrendingDownSharp'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { supabase, formatMoney } from '../lib/supabase'
import { listRowSx } from '../theme'
import { SummaryCardsSkeleton, ChartSkeleton, RowCardsSkeleton } from '../components/skeletons'

interface QuickAction {
  label: string
  icon: JSX.Element
  path: string
  accent?: boolean
}

const ACTIONS: QuickAction[] = [
  { label: 'New sale', icon: <SellIcon fontSize="large" />, path: '/sale/new', accent: true },
  { label: 'All sales', icon: <ReceiptLongIcon fontSize="large" />, path: '/sales' },
  { label: 'Sales report', icon: <BarChartIcon fontSize="large" />, path: '/reports' },
  { label: 'Manage stock', icon: <InventoryIcon fontSize="large" />, path: '/stock/add' },
  { label: 'Manage customers', icon: <PeopleIcon fontSize="large" />, path: '/customers' },
  { label: 'Inventory', icon: <ClipboardListIcon fontSize="large" />, path: '/low-stock' },
  { label: 'Ask MIG', icon: <SmartToyIcon fontSize="large" />, path: '/chat' }
]

interface RecentSale {
  id: string
  receipt_no: string
  total: number
  created_at: string
  customers: { name: string } | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [todayTotal, setTodayTotal] = useState<number | null>(null)
  const [todayCount, setTodayCount] = useState<number>(0)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [lowStockCount, setLowStockCount] = useState<number>(0)
  const [trend, setTrend] = useState<{ day: string; total: number }[]>([])
  const [trendPercent, setTrendPercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  useEffect(() => {
    void loadDashboard()
    void loadRecentActivity()
  }, [])

  async function loadDashboard() {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const { data: todaySales } = await supabase
      .from('sales')
      .select('total')
      .eq('status', 'active')
      .gte('created_at', startOfToday.toISOString())

    let todayTotalValue = 0
    if (todaySales) {
      todayTotalValue = todaySales.reduce((sum, s) => sum + s.total, 0)
      setTodayTotal(todayTotalValue)
      setTodayCount(todaySales.length)
    }

    const { count: pending } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'pending')
      .eq('status', 'active')
    setPendingCount(pending ?? 0)

    const { count: lowStock } = await supabase.from('low_stock_view').select('variant_id', { count: 'exact', head: true })
    setLowStockCount(lowStock ?? 0)

    // Real trend %: compare today's total so far against the same weekday last week
    // (not yesterday) so day-of-week sales patterns (e.g. weekends being busier) aren't
    // mistaken for a real trend.
    const sameWeekdayLastWeekStart = new Date(startOfToday)
    sameWeekdayLastWeekStart.setDate(sameWeekdayLastWeekStart.getDate() - 7)
    const sameWeekdayLastWeekEnd = new Date(sameWeekdayLastWeekStart)
    sameWeekdayLastWeekEnd.setDate(sameWeekdayLastWeekEnd.getDate() + 1)

    const { data: lastWeekSales } = await supabase
      .from('sales')
      .select('total')
      .eq('status', 'active')
      .gte('created_at', sameWeekdayLastWeekStart.toISOString())
      .lt('created_at', sameWeekdayLastWeekEnd.toISOString())

    const lastWeekTotal = lastWeekSales?.reduce((sum, s) => sum + s.total, 0) ?? 0
    if (lastWeekTotal > 0) {
      setTrendPercent(((todayTotalValue - lastWeekTotal) / lastWeekTotal) * 100)
    } else {
      // Divide-by-zero guard: no sales that day last week means "% change" is
      // meaningless — hide the chip rather than show Infinity/NaN or a fake 0%.
      setTrendPercent(null)
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const { data: recent } = await supabase
      .from('sales')
      .select('total, created_at')
      .eq('status', 'active')
      .gte('created_at', sevenDaysAgo.toISOString())

    const buckets: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo)
      d.setDate(d.getDate() + i)
      buckets[d.toLocaleDateString('en-IN', { weekday: 'short' })] = 0
    }
    recent?.forEach((s) => {
      const key = new Date(s.created_at).toLocaleDateString('en-IN', { weekday: 'short' })
      buckets[key] = (buckets[key] ?? 0) + s.total
    })
    setTrend(Object.entries(buckets).map(([day, total]) => ({ day, total: total / 100 })))
    setLoading(false)
  }

  async function loadRecentActivity() {
    const { data } = await supabase
      .from('sales')
      .select('id, receipt_no, total, created_at, customers(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentSales((data as unknown as RecentSale[]) ?? [])
    setRecentLoading(false)
  }

  const trendUp = (trendPercent ?? 0) >= 0

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {getGreeting()}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Typography>

      {loading ? (
        <>
          <ChartSkeleton height={170} />
          <SummaryCardsSkeleton count={2} />
        </>
      ) : (
        <>
          <Paper sx={{ p: 2.5, mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Sales today
                </Typography>
                <Typography variant="mono" sx={{ fontSize: 32, fontWeight: 600, display: 'block', mt: 0.5, lineHeight: 1.1 }}>
                  {todayTotal === null ? '—' : formatMoney(todayTotal)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {todayCount} receipt{todayCount === 1 ? '' : 's'} today
                </Typography>
              </Box>
              {trendPercent !== null && (
                <Chip
                  size="small"
                  icon={trendUp ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                  label={`${trendUp ? '+' : ''}${trendPercent.toFixed(1)}%`}
                  sx={{
                    bgcolor: alpha(trendUp ? theme.palette.success.main : theme.palette.error.main, 0.15),
                    color: trendUp ? theme.palette.success.main : theme.palette.error.main,
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'inherit' }
                  }}
                />
              )}
            </Stack>

            <Box sx={{ height: 110, mt: 1.5, mx: -1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString('en-IN')}`, 'Sales']} />
                  <Area type="monotone" dataKey="total" stroke={theme.palette.primary.main} strokeWidth={2} fill="url(#trendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <StatTile
                icon={<PaymentsIcon />}
                iconColor={theme.palette.warning.main}
                label="Pending balances"
                value={String(pendingCount)}
                onClick={() => navigate('/sales?filter=pending')}
              />
            </Grid>
            <Grid item xs={6}>
              <StatTile
                icon={<WarningIcon />}
                iconColor={theme.palette.error.main}
                label="Low stock items"
                value={String(lowStockCount)}
                onClick={() => navigate('/low-stock')}
              />
            </Grid>
          </Grid>
        </>
      )}

      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        Quick actions
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          pb: 1,
          mb: 3,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {ACTIONS.map((action) => (
          <Paper
            key={action.label}
            onClick={() => navigate(action.path)}
            sx={{
              flex: '0 0 auto',
              width: 100,
              aspectRatio: '1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
              color: action.accent ? 'primary.contrastText' : 'text.primary',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              ...(action.accent && {
                border: '1px solid rgba(224,164,97,0.35)',
                backgroundImage: 'linear-gradient(135deg, #E0A461 0%, #C97A2B 55%, #9C5D1E 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 28px -6px rgba(201,122,43,0.55), 0 2px 8px rgba(0,0,0,0.35)'
              }),
              '&:hover': {
                transform: 'translateY(-2px) scale(1.02)',
                ...(!action.accent && { borderColor: 'rgba(201,122,43,0.4)' }),
                ...(action.accent && {
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 12px 34px -6px rgba(201,122,43,0.7), 0 2px 8px rgba(0,0,0,0.4)'
                })
              },
              '&:active': { transform: 'translateY(0) scale(0.98)' }
            }}
          >
            {action.icon}
            <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center', px: 0.5 }}>
              {action.label}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        Recent activity
      </Typography>
      {recentLoading ? (
        <RowCardsSkeleton rows={3} />
      ) : recentSales.length === 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No sales yet.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {recentSales.map((sale) => (
            <Box key={sale.id} onClick={() => navigate('/sales')} sx={listRowSx(theme)}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {sale.customers?.name ?? 'Walk-in customer'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sale.receipt_no} &middot; {formatRelativeTime(sale.created_at)}
                </Typography>
              </Box>
              <Typography variant="mono" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {formatMoney(sale.total)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

function StatTile({
  icon,
  iconColor,
  label,
  value,
  onClick
}: {
  icon: JSX.Element
  iconColor: string
  label: string
  value: string
  onClick?: () => void
}) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...(onClick && {
          '&:hover': { transform: 'scale(1.02)', borderColor: 'rgba(201,122,43,0.4)' },
          '&:active': { transform: 'scale(0.98)' }
        })
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: alpha(iconColor, 0.15),
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& svg': { fontSize: 20 }
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="mono" sx={{ fontSize: 20, fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  )
}
