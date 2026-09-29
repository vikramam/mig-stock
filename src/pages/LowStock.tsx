import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { supabase, formatMoney } from '../lib/supabase'
import { listRowSx } from '../theme'
import { LowStockRow, formatSize } from '../types'
import { TableSkeleton } from '../components/skeletons'

export default function LowStock() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [rows, setRows] = useState<LowStockRow[]>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [oversoldOnly, setOversoldOnly] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)

    const [{ data: rowsData, error: rowsError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from('low_stock_view').select('*').order('current_stock', { ascending: true }),
      supabase.from('settings').select('low_stock_threshold').eq('id', 1).single()
    ])

    const error = rowsError || settingsError
    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }

    setRows((rowsData ?? []) as LowStockRow[])
    setThreshold(settingsData?.low_stock_threshold ?? null)
    setLoading(false)
  }

  const productOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.product_name))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const typeOptions = useMemo(() => {
    const relevant = productFilter ? rows.filter((r) => r.product_name === productFilter) : rows
    const names = new Set(relevant.map((r) => r.type_name))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows, productFilter])

  function handleProductFilterChange(value: string) {
    setProductFilter(value)
    setTypeFilter('')
  }

  const searchLower = search.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    if (productFilter && row.product_name !== productFilter) return false
    if (typeFilter && row.type_name !== typeFilter) return false
    if (oversoldOnly && row.current_stock >= 0) return false
    if (searchLower) {
      const matches =
        row.product_name.toLowerCase().includes(searchLower) || row.type_name.toLowerCase().includes(searchLower)
      if (!matches) return false
    }
    return true
  })

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Low stock
        </Typography>
        <TableSkeleton rows={6} columns={5} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load low stock items: {loadError}
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Low stock
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {threshold !== null ? `Active variants below ${threshold} units in stock.` : 'Active variants running low on stock.'}
      </Typography>

      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          placeholder="Search product or type"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'aria-label': 'Search product or type' }}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          label="Product"
          size="small"
          value={productFilter}
          onChange={(e) => handleProductFilterChange(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {productOptions.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Type"
          size="small"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {typeOptions.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={oversoldOnly} onChange={(e) => setOversoldOnly(e.target.checked)} />}
          label="Oversold only"
        />
      </Stack>

      {rows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">Nothing is low on stock right now.</Typography>
        </Paper>
      ) : visibleRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">No low stock items match these filters.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {visibleRows.map((row) => (
            <Box key={row.variant_id} sx={listRowSx(theme)}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                  {row.product_name} · {row.type_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.size_label ?? `Size ${formatSize(row.size ?? 0)}`}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" gap={2} sx={{ flexShrink: 0 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="mono"
                    color={row.current_stock <= 0 ? 'error.main' : 'warning.main'}
                    sx={{ display: 'block', fontWeight: 700 }}
                  >
                    {row.current_stock}
                  </Typography>
                  <Typography variant="mono" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {formatMoney(row.unit_price)}
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => navigate(`/stock/add?variant=${row.variant_id}`)}>
                  Restock
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
