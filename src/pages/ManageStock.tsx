import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Stack,
  Alert,
  Link as MuiLink,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material'
import { supabase, formatMoney, fetchActiveVariants } from '../lib/supabase'
import { VariantWithContext, formatVariantLabel, formatSize } from '../types'
import { FormSkeleton } from '../components/skeletons'

interface LastMovement {
  change_qty: number
  reason: string
  created_at: string
  balance_before: number
}

export default function ManageStock() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetVariantId = searchParams.get('variant')
  const [variants, setVariants] = useState<VariantWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<'add' | 'update'>('add')

  const [pickProductId, setPickProductId] = useState('')
  const [pickTypeId, setPickTypeId] = useState('')
  const [pickVariantId, setPickVariantId] = useState('')
  const [qty, setQty] = useState('')
  const [newStock, setNewStock] = useState('')
  const [note, setNote] = useState('')
  const [addedBy, setAddedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [lastMovement, setLastMovement] = useState<LastMovement | null>(null)
  const [undoOpen, setUndoOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  useEffect(() => {
    void loadVariants()
  }, [])

  useEffect(() => {
    if (!presetVariantId) return
    const match = variants.find((v) => v.id === presetVariantId)
    if (match) {
      setPickProductId(match.product_id)
      setPickTypeId(match.type_id)
      setPickVariantId(match.id)
    }
  }, [variants, presetVariantId])

  async function loadVariants() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await fetchActiveVariants()
    if (error) setLoadError(error)
    else setVariants(data)
    setLoading(false)
  }

  const productOptions = useMemo(() => {
    const map = new Map<string, string>()
    variants.forEach((v) => {
      if (!map.has(v.product_id)) map.set(v.product_id, v.product_name)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [variants])

  const typeOptions = useMemo(() => {
    if (!pickProductId) return []
    const map = new Map<string, { id: string; label: string }>()
    variants
      .filter((v) => v.product_id === pickProductId)
      .forEach((v) => {
        if (!map.has(v.type_id)) map.set(v.type_id, { id: v.type_id, label: v.type_name })
      })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [variants, pickProductId])

  const sizeOptions = useMemo(() => {
    if (!pickTypeId) return []
    return variants.filter((v) => v.type_id === pickTypeId).sort((a, b) => a.size - b.size)
  }, [variants, pickTypeId])

  const selected = sizeOptions.find((v) => v.id === pickVariantId) ?? null

  useEffect(() => {
    setSuccess(null)
    setSubmitError(null)
    setNewStock(selected ? String(selected.current_stock) : '')
    if (selected) void loadLastMovement(selected.id)
    else setLastMovement(null)
  }, [selected?.id])

  async function loadLastMovement(variantId: string) {
    const { data } = await supabase
      .from('stock_movements')
      .select('change_qty, reason, created_at, balance_before')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMovement((data as LastMovement) ?? null)
  }

  function handleProductPick(id: string) {
    setPickProductId(id)
    setPickTypeId('')
    setPickVariantId('')
  }

  function handleTypePick(id: string) {
    setPickTypeId(id)
    setPickVariantId('')
  }

  const qtyNum = parseInt(qty, 10)
  const newStockNum = parseInt(newStock, 10)
  const addValid = !!selected && Number.isInteger(qtyNum) && qtyNum > 0
  const updateValid = !!selected && Number.isInteger(newStockNum) && newStockNum !== selected.current_stock
  const canUndoLastAdd = !!selected && lastMovement?.reason === 'purchase'

  async function handleAddSubmit() {
    if (!selected || !addValid) return
    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)

    const { error } = await supabase.rpc('add_stock', {
      p_variant_id: selected.id,
      p_qty: qtyNum,
      p_note: note.trim() || null,
      p_created_by: addedBy.trim() || null
    })

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }

    setSuccess(`Added ${qtyNum} to ${formatVariantLabel(selected)} — new balance: ${selected.current_stock + qtyNum}`)
    setQty('')
    setNote('')
    void loadVariants()
  }

  async function handleUpdateSubmit() {
    if (!selected || !updateValid) return
    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)

    const { error } = await supabase.rpc('adjust_stock', {
      p_variant_id: selected.id,
      p_new_stock: newStockNum,
      p_note: note.trim() || null,
      p_created_by: addedBy.trim() || null
    })

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }

    setSuccess(`Updated ${formatVariantLabel(selected)} — new balance: ${newStockNum}`)
    setNote('')
    void loadVariants()
  }

  async function confirmUndo() {
    if (!selected) return
    setUndoing(true)
    setUndoError(null)

    const { error } = await supabase.rpc('undo_last_stock_addition', { p_variant_id: selected.id })

    setUndoing(false)
    if (error) {
      setUndoError(error.message)
      return
    }

    setUndoOpen(false)
    setSuccess(`Reverted the last stock addition to ${formatVariantLabel(selected)}`)
    void loadVariants()
    void loadLastMovement(selected.id)
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Manage stock
        </Typography>
        <FormSkeleton fields={4} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load variants: {loadError}
      </Alert>
    )
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Manage stock
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Record a new purchase/restock, or correct a variant's stock count.{' '}
        <MuiLink component="button" onClick={() => navigate('/catalog')}>
          Manage catalog
        </MuiLink>
      </Typography>

      <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Tabs value={mode} onChange={(_, v) => setMode(v)} variant="fullWidth">
            <Tab label="Add new stock" value="add" />
            <Tab label="Update existing stock" value="update" />
          </Tabs>

          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <TextField select label="Product" value={pickProductId} onChange={(e) => handleProductPick(e.target.value)} fullWidth>
            {productOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Type"
            value={pickTypeId}
            onChange={(e) => handleTypePick(e.target.value)}
            disabled={!pickProductId}
            fullWidth
          >
            {typeOptions.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Size"
            value={pickVariantId}
            onChange={(e) => setPickVariantId(e.target.value)}
            disabled={!pickTypeId}
            fullWidth
          >
            {sizeOptions.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {formatSize(v.size)} — {formatMoney(v.unit_price)} · {v.current_stock} in stock
              </MenuItem>
            ))}
          </TextField>

          {selected && (
            <Typography variant="body2" color="text.secondary">
              Current price {formatMoney(selected.unit_price)} · Current stock {selected.current_stock}
            </Typography>
          )}

          {selected && canUndoLastAdd && lastMovement && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => setUndoOpen(true)}>
                  Undo
                </Button>
              }
            >
              Last added: +{lastMovement.change_qty} on{' '}
              {new Date(lastMovement.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Alert>
          )}

          <Divider />

          {mode === 'add' ? (
            <TextField
              label="Quantity to add"
              type="number"
              inputProps={{ step: '1', min: 1 }}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              fullWidth
            />
          ) : (
            <TextField
              label="New stock quantity"
              type="number"
              inputProps={{ step: '1' }}
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              helperText="Sets the stock count directly — use this to correct it after a physical recount."
              fullWidth
            />
          )}

          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <TextField
            label="Added by (optional)"
            placeholder="e.g. owner, father"
            value={addedBy}
            onChange={(e) => setAddedBy(e.target.value)}
            fullWidth
          />

          {mode === 'add' ? (
            <Button variant="contained" size="large" disabled={!addValid || submitting} onClick={() => void handleAddSubmit()}>
              Add stock
            </Button>
          ) : (
            <Button variant="contained" size="large" disabled={!updateValid || submitting} onClick={() => void handleUpdateSubmit()}>
              Update stock
            </Button>
          )}
        </Stack>
      </Paper>

      <Dialog open={undoOpen} onClose={() => setUndoOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Undo last stock addition?</DialogTitle>
        <DialogContent>
          {undoError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {undoError}
            </Alert>
          )}
          <Typography variant="body2">
            This removes the last +{lastMovement?.change_qty} addition to {selected ? formatVariantLabel(selected) : ''} and
            reverts its stock back to {lastMovement?.balance_before}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUndoOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={undoing} onClick={() => void confirmUndo()}>
            Undo addition
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
