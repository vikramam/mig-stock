import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Paper, TextField, Button, Stack, Alert, List, ListItem, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  FileDownloadIcon as FileDownloadSharp,
  FileUploadIcon as FileUploadSharp,
  BackupIcon as CloudDownloadSharp,
  ChevronRightIcon as ChevronRightSharp
} from '../components/icons'
import { supabase } from '../lib/supabase'
import { downloadRowsAsSheet, downloadWorkbook, readWorkbookFile, sheetToRows } from '../lib/excel'
import { importCatalogRows, CatalogImportRow, CatalogImportSummary } from '../lib/catalogImport'
import { listRowSx } from '../theme'
import { FormSkeleton } from '../components/skeletons'
import BackButton from '../components/common/BackButton'

const BACKUP_TABLES = [
  'products',
  'sizes',
  'product_types',
  'variants',
  'customers',
  'sales',
  'sale_items',
  'payments',
  'stock_movements',
  'settings'
]

interface CatalogExportRow {
  name: string
  product_types: {
    type_name: string
    variants: { unit_price: number; current_stock: number; sizes: { value: number } | null }[]
  }[]
}

export default function Settings() {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [currency, setCurrency] = useState('')
  const [currencyPrefix, setCurrencyPrefix] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const importInputRef = useRef<HTMLInputElement>(null)
  const [catalogExportBusy, setCatalogExportBusy] = useState(false)
  const [catalogExportError, setCatalogExportError] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<CatalogImportSummary | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()

    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }

    setCompanyName(data.company_name ?? '')
    setCurrency(data.currency ?? '')
    setCurrencyPrefix(data.currency_prefix ?? '')
    setReceiptFooter(data.receipt_footer ?? '')
    setLowStockThreshold(String(data.low_stock_threshold ?? ''))
    setLoading(false)
  }

  const thresholdNum = parseInt(lowStockThreshold, 10)
  const valid =
    companyName.trim().length > 0 &&
    currency.trim().length > 0 &&
    currencyPrefix.trim().length > 0 &&
    Number.isInteger(thresholdNum) &&
    thresholdNum >= 0

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    setSaveError(null)
    setSuccess(false)

    const { error } = await supabase
      .from('settings')
      .update({
        company_name: companyName.trim(),
        currency: currency.trim(),
        currency_prefix: currencyPrefix.trim(),
        receipt_footer: receiptFooter.trim() || null,
        low_stock_threshold: thresholdNum
      })
      .eq('id', 1)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setSuccess(true)
  }

  async function handleExportCatalog() {
    setCatalogExportBusy(true)
    setCatalogExportError(null)

    const { data, error } = await supabase
      .from('products')
      .select('name, product_types(type_name, variants(unit_price, current_stock, sizes(value)))')
      .order('name', { ascending: true })

    setCatalogExportBusy(false)
    if (error) {
      setCatalogExportError(error.message)
      return
    }

    const rows = ((data ?? []) as unknown as CatalogExportRow[]).flatMap((product) =>
      product.product_types.flatMap((type) =>
        type.variants.map((variant) => ({
          Product: product.name,
          Type: type.type_name,
          'Size (in)': variant.sizes?.value ?? '',
          'Price (Rs.)': variant.unit_price / 100,
          'Opening stock': variant.current_stock
        }))
      )
    )

    await downloadRowsAsSheet(rows, 'Catalog', 'catalog.xlsx')
  }

  async function handleExportBackup() {
    setBackupBusy(true)
    setBackupError(null)

    const results = await Promise.all(BACKUP_TABLES.map((table) => supabase.from(table).select('*')))
    const failed = results.find((r) => r.error)
    setBackupBusy(false)
    if (failed?.error) {
      setBackupError(failed.error.message)
      return
    }

    const sheets = BACKUP_TABLES.map((name, i) => ({ name, rows: (results[i].data ?? []) as Record<string, unknown>[] }))
    await downloadWorkbook(sheets, `mig-stock-backup-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImportBusy(true)
    setImportError(null)
    setImportSummary(null)

    try {
      const wb = await readWorkbookFile(file)
      const rows = await sheetToRows<CatalogImportRow>(wb)
      const summary = await importCatalogRows(rows)
      setImportSummary(summary)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read that file.')
    }
    setImportBusy(false)
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
          <BackButton />
          <Typography variant="h4">Settings</Typography>
        </Stack>
        <Stack spacing={2}>
          <FormSkeleton fields={4} />
          <FormSkeleton fields={2} actionWidth={160} />
        </Stack>
      </Box>
    )
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
          <BackButton />
          <Typography variant="h4">Settings</Typography>
        </Stack>
        <Alert severity="error">Failed to load settings: {loadError}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
        <BackButton />
        <Typography variant="h4">Settings</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, ml: '52px' }}>
        Business details and stock alert threshold.
      </Typography>

      <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          {success && (
            <Alert severity="success" onClose={() => setSuccess(false)}>
              Settings saved.
            </Alert>
          )}
          {saveError && (
            <Alert severity="error" onClose={() => setSaveError(null)}>
              {saveError}
            </Alert>
          )}

          <TextField
            placeholder="Company name"
            inputProps={{ 'aria-label': 'Company name' }}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            fullWidth
          />

          <Stack direction="row" gap={2}>
            <TextField
              placeholder="Currency code"
              inputProps={{ 'aria-label': 'Currency code' }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              fullWidth
            />
            <TextField
              placeholder="e.g. Rs."
              inputProps={{ 'aria-label': 'Currency prefix' }}
              value={currencyPrefix}
              onChange={(e) => setCurrencyPrefix(e.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            placeholder="e.g. Thank you for your business!"
            inputProps={{ 'aria-label': 'Receipt footer (optional)' }}
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <TextField
            placeholder="Low stock threshold"
            type="number"
            inputProps={{ 'aria-label': 'Low stock threshold', step: '1', min: 0 }}
            helperText="Variants with stock below this number show up on the Low stock page."
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            fullWidth
          />

          <Button variant="contained" size="large" disabled={!valid || saving} onClick={() => void handleSave()}>
            Save settings
          </Button>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mt: 4, mb: 0.5 }}>
        Catalog data
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Export the catalog to edit in bulk, or import a spreadsheet to seed new products,
        types, and sizes.
      </Typography>

      <Stack spacing={1.25}>
        <Box
          role="button"
          tabIndex={0}
          aria-disabled={catalogExportBusy}
          onClick={() => {
            if (!catalogExportBusy) void handleExportCatalog()
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !catalogExportBusy) {
              e.preventDefault()
              void handleExportCatalog()
            }
          }}
          sx={{
            ...listRowSx(theme),
            cursor: catalogExportBusy ? 'default' : 'pointer',
            opacity: catalogExportBusy ? 0.7 : 1
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0, flex: 1 }}>
            <FileDownloadSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                {catalogExportBusy ? 'Exporting…' : 'Export catalog (.xlsx)'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Same file format is expected on import.
              </Typography>
            </Box>
          </Stack>
          {catalogExportBusy ? (
            <CircularProgress size={18} sx={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          )}
        </Box>

        <Box
          role="button"
          tabIndex={0}
          aria-disabled={importBusy}
          onClick={() => {
            if (!importBusy) importInputRef.current?.click()
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !importBusy) {
              e.preventDefault()
              importInputRef.current?.click()
            }
          }}
          sx={{
            ...listRowSx(theme),
            cursor: importBusy ? 'default' : 'pointer',
            opacity: importBusy ? 0.7 : 1
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0, flex: 1 }}>
            <FileUploadSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                {importBusy ? 'Importing…' : 'Import catalog (.xlsx)'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Same format as the export above.
              </Typography>
            </Box>
          </Stack>
          {importBusy ? (
            <CircularProgress size={18} sx={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          )}
        </Box>
        <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void handleImportFile(e)} />

        <Box
          role="button"
          tabIndex={0}
          aria-disabled={backupBusy}
          onClick={() => {
            if (!backupBusy) void handleExportBackup()
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !backupBusy) {
              e.preventDefault()
              void handleExportBackup()
            }
          }}
          sx={{
            ...listRowSx(theme),
            cursor: backupBusy ? 'default' : 'pointer',
            opacity: backupBusy ? 0.7 : 1
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0, flex: 1 }}>
            <CloudDownloadSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                {backupBusy ? 'Preparing…' : 'Download full backup (.xlsx)'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Every table, one sheet each — for safekeeping, not for re-importing.
              </Typography>
            </Box>
          </Stack>
          {backupBusy ? (
            <CircularProgress size={18} sx={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightSharp fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          )}
        </Box>
      </Stack>

      {(catalogExportError || importError || importSummary || backupError) && (
        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
          {catalogExportError && (
            <Alert severity="error" onClose={() => setCatalogExportError(null)}>
              {catalogExportError}
            </Alert>
          )}

          {importError && (
            <Alert severity="error" onClose={() => setImportError(null)}>
              {importError}
            </Alert>
          )}

          {importSummary && (
            <Alert severity={importSummary.errors.length > 0 ? 'warning' : 'success'} onClose={() => setImportSummary(null)}>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Created {importSummary.productsCreated} product(s), {importSummary.typesCreated} type(s),{' '}
                  {importSummary.variantsCreated} variant(s). Skipped {importSummary.variantsSkipped} existing variant(s).
                </Typography>
                {importSummary.errors.length > 0 && (
                  <List dense sx={{ py: 0 }}>
                    {importSummary.errors.map((err, i) => (
                      <ListItem key={i} sx={{ py: 0, display: 'list-item', pl: 2 }}>
                        <Typography variant="caption">{err}</Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Stack>
            </Alert>
          )}

          {backupError && (
            <Alert severity="error" onClose={() => setBackupError(null)}>
              {backupError}
            </Alert>
          )}
        </Stack>
      )}
    </Box>
  )
}
