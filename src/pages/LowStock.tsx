import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Alert,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Tabs,
  Tab
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardSharp'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardSharp'
import { AddIcon } from '../components/icons'
import { supabase, formatMoney, fetchActiveVariants } from '../lib/supabase'
import { listRowSx, stockCellColor } from '../theme'
import { VariantWithContext, variantSizeText } from '../types'
import { TableSkeleton } from '../components/skeletons'

type StockTab = 'low' | 'existing'

export default function LowStock() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [variants, setVariants] = useState<VariantWithContext[]>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [tab, setTab] = useState<StockTab>('low')

  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [oversoldOnly, setOversoldOnly] = useState(false)
  const [qtySortDir, setQtySortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)

    const [{ data: variantsData, error: variantsError }, { data: settingsData, error: settingsError }] = await Promise.all([
      fetchActiveVariants(),
      supabase.from('settings').select('low_stock_threshold').eq('id', 1).single()
    ])

    if (variantsError) {
      setLoadError(variantsError)
      setLoading(false)
      return
    }
    if (settingsError) {
      setLoadError(settingsError.message)
      setLoading(false)
      return
    }

    setVariants(variantsData)
    setThreshold(settingsData?.low_stock_threshold ?? null)
    setLoading(false)
  }

  // Filter dropdown options come from the full active variant set (not the current tab's
  // rows) so they stay stable across tab switches, per "filters apply to both tabs".
  const productOptions = useMemo(() => {
    const names = new Set(variants.map((v) => v.product_name))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [variants])

  const typeOptions = useMemo(() => {
    const relevant = productFilter ? variants.filter((v) => v.product_name === productFilter) : variants
    const names = new Set(relevant.map((v) => v.type_name))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [variants, productFilter])

  function handleProductFilterChange(value: string) {
    setProductFilter(value)
    setTypeFilter('')
  }

  // Low stock: everything below the configured threshold (negative/oversold included —
  // same rule low_stock_view enforced). Existing stock: everything actually on hand. The
  // two sets overlap (a variant can be both "low" and "existing" at once) — that's
  // expected, they're independent views over the same data, not a partition.
  const lowStockRows = useMemo(
    () => (threshold !== null ? variants.filter((v) => v.current_stock < threshold) : []),
    [variants, threshold]
  )
  const existingStockRows = useMemo(() => variants.filter((v) => v.current_stock > 0), [variants])
  const baseRows = tab === 'low' ? lowStockRows : existingStockRows

  const searchLower = search.trim().toLowerCase()
  const visibleRows = baseRows.filter((row) => {
    if (productFilter && row.product_name !== productFilter) return false
    if (typeFilter && row.type_name !== typeFilter) return false
    if (tab === 'low' && oversoldOnly && row.current_stock >= 0) return false
    if (searchLower) {
      const matches =
        row.product_name.toLowerCase().includes(searchLower) || row.type_name.toLowerCase().includes(searchLower)
      if (!matches) return false
    }
    return true
  })
  visibleRows.sort((a, b) => (qtySortDir === 'asc' ? a.current_stock - b.current_stock : b.current_stock - a.current_stock))

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Inventory
        </Typography>
        <TableSkeleton rows={6} columns={5} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load inventory: {loadError}
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Inventory
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tab === 'low'
          ? threshold !== null
            ? `Active variants below ${threshold} units in stock.`
            : 'Active variants running low on stock.'
          : 'Active variants currently in stock.'}
      </Typography>

      <Paper sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v: StockTab) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab label="Low stock" value="low" />
          <Tab label="Existing stock" value="existing" />
        </Tabs>

        <Stack spacing={1.5} sx={{ p: 2 }}>
          <TextField
            placeholder="Search product or type"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'aria-label': 'Search product or type' }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              label="Product"
              size="small"
              value={productFilter}
              onChange={(e) => handleProductFilterChange(e.target.value)}
              sx={{ flex: 1, minWidth: 0 }}
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
              sx={{ flex: 1, minWidth: 0 }}
            >
              <MenuItem value="">All</MenuItem>
              {typeOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <IconButton
              size="small"
              onClick={() => setQtySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              aria-label={qtySortDir === 'asc' ? 'Sort quantity ascending' : 'Sort quantity descending'}
              sx={{ flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
            >
              {qtySortDir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
            </IconButton>
          </Stack>
          {tab === 'low' && (
            <FormControlLabel
              sx={{ mx: 0, alignSelf: 'flex-start' }}
              control={<Switch checked={oversoldOnly} onChange={(e) => setOversoldOnly(e.target.checked)} />}
              label="Oversold only"
            />
          )}
        </Stack>
      </Paper>

      {baseRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">
            {tab === 'low' ? 'Nothing is low on stock right now.' : 'No stock on hand right now.'}
          </Typography>
        </Paper>
      ) : visibleRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">No items match these filters.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {visibleRows.map((row) => (
            <Box key={row.id} sx={listRowSx(theme)}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                  {row.product_name} · {row.type_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {variantSizeText(row)}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" gap={2} sx={{ flexShrink: 0 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="mono"
                    color={stockCellColor(row.current_stock, threshold ?? 10)}
                    sx={{ display: 'block', fontWeight: 700 }}
                  >
                    {row.current_stock} In Stock
                  </Typography>
                  <Typography variant="mono" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                    {formatMoney(row.unit_price)}/Pc
                  </Typography>
                </Box>
                {tab === 'low' && (
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/stock/add?variant=${row.id}`)}
                    aria-label="Restock"
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
