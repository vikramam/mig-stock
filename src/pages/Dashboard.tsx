import { useEffect, useState } from 'react'
import { Box, Grid, Paper, Typography, Chip, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import SellIcon from '@mui/icons-material/PointOfSaleSharp'
import InventoryIcon from '@mui/icons-material/Inventory2Sharp'
import PersonAddIcon from '@mui/icons-material/PersonAddAltSharp'
import WarningIcon from '@mui/icons-material/ReportProblemSharp'
import BarChartIcon from '@mui/icons-material/BarChartSharp'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongSharp'
import SmartToyIcon from '@mui/icons-material/SmartToySharp'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { useTheme } from '@mui/material/styles'
import { supabase, formatMoney } from '../lib/supabase'
import { SummaryCardsSkeleton, ChartSkeleton } from '../components/skeletons'

interface QuickAction {
  label: string
  icon: JSX.Element
  path: string
  accent?: boolean
}

const ACTIONS: QuickAction[] = [
  { label: 'New sale', icon: <SellIcon fontSize="large" />, path: '/sale/new', accent: true },
  { label: 'Add stock', icon: <InventoryIcon fontSize="large" />, path: '/stock/add' },
  { label: 'New customer', icon: <PersonAddIcon fontSize="large" />, path: '/customers/new' },
  { label: 'Low stock', icon: <WarningIcon fontSize="large" />, path: '/low-stock' },
  { label: 'Sales report', icon: <BarChartIcon fontSize="large" />, path: '/reports' },
  { label: 'All sales', icon: <ReceiptLongIcon fontSize="large" />, path: '/sales' },
  { label: 'Ask MIG', icon: <SmartToyIcon fontSize="large" />, path: '/chat' }
]

export default function Dashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [todayTotal, setTodayTotal] = useState<number | null>(null)
  const [todayCount, setTodayCount] = useState<number>(0)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [lowStockCount, setLowStockCount] = useState<number>(0)
  const [trend, setTrend] = useState<{ day: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const { data: todaySales } = await supabase
      .from('sales')
      .select('total')
      .eq('status', 'active')
      .gte('created_at', startOfToday.toISOString())

    if (todaySales) {
      setTodayTotal(todaySales.reduce((sum, s) => sum + s.total, 0))
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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Today
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Typography>

      {loading ? (
        <>
          <SummaryCardsSkeleton count={4} />
          <ChartSkeleton height={140} />
        </>
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Sales today" value={todayTotal === null ? '—' : formatMoney(todayTotal)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Receipts today" value={String(todayCount)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard
                label="Pending balances"
                value={String(pendingCount)}
                chipColor={pendingCount > 0 ? 'warning' : undefined}
                onClick={() => navigate('/sales?filter=pending')}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard
                label="Low stock items"
                value={String(lowStockCount)}
                chipColor={lowStockCount > 0 ? 'error' : undefined}
                onClick={() => navigate('/low-stock')}
              />
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Last 7 days (Rs.)
            </Typography>
            <Box sx={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString('en-IN')}`, 'Sales']} />
                  <Area type="monotone" dataKey="total" stroke={theme.palette.primary.main} strokeWidth={2} fill="url(#trendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </>
      )}

      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        Quick actions
      </Typography>
      <Grid container spacing={1.5}>
        {ACTIONS.map((action) => (
          <Grid item xs={4} sm={4} md={2} key={action.label}>
            <Paper
              onClick={() => navigate(action.path)}
              sx={{
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
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

function SummaryCard({
  label,
  value,
  chipColor,
  onClick
}: {
  label: string
  value: string
  chipColor?: 'warning' | 'error'
  onClick?: () => void
}) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...(onClick && {
          '&:hover': { transform: 'scale(1.02)', borderColor: 'rgba(201,122,43,0.4)' },
          '&:active': { transform: 'scale(0.98)' }
        })
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {chipColor && <Chip size="small" color={chipColor} label="!" sx={{ height: 18, minWidth: 18, '& .MuiChip-label': { px: 0.7 } }} />}
      </Stack>
      <Typography variant="mono" sx={{ fontSize: 22, display: 'block', mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  )
}
