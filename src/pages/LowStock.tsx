import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch
} from '@mui/material'
import { supabase, formatMoney } from '../lib/supabase'
import { LowStockRow, formatSize } from '../types'

export default function LowStock() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<LowStockRow[]>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('')
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

  const searchLower = search.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    if (productFilter && row.product_name !== productFilter) return false
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
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
          label="Search product or type"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          label="Product"
          size="small"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {productOptions.map((name) => (
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
        <Paper sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Size</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.variant_id}>
                  <TableCell>{row.product_name}</TableCell>
                  <TableCell>{row.type_name}</TableCell>
                  <TableCell>{formatSize(row.size)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="mono" color={row.current_stock <= 0 ? 'error.main' : 'warning.main'}>
                      {row.current_stock}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="mono">{formatMoney(row.unit_price)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => navigate(`/stock/add?variant=${row.variant_id}`)}>
                      Add stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}
