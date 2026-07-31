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
  Link as MuiLink
} from '@mui/material'
import { supabase, formatMoney, fetchActiveVariants } from '../lib/supabase'
import { VariantWithContext, formatVariantLabel, formatSize } from '../types'
import { FormSkeleton } from '../components/skeletons'

export default function AddStock() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetVariantId = searchParams.get('variant')
  const [variants, setVariants] = useState<VariantWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [pickProductId, setPickProductId] = useState('')
  const [pickTypeId, setPickTypeId] = useState('')
  const [pickVariantId, setPickVariantId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [addedBy, setAddedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ label: string; newStock: number } | null>(null)

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
  const valid = !!selected && Number.isInteger(qtyNum) && qtyNum > 0

  async function handleSubmit() {
    if (!selected || !valid) return
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

    setSuccess({ label: formatVariantLabel(selected), newStock: selected.current_stock + qtyNum })
    setPickProductId('')
    setPickTypeId('')
    setPickVariantId('')
    setQty('')
    setNote('')
    void loadVariants()
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Add stock
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
        Add stock
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Record a new purchase/restock for an existing variant.{' '}
        <MuiLink component="button" onClick={() => navigate('/stock')}>
          Manage catalog
        </MuiLink>
      </Typography>

      <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              Added stock to {success.label} — new balance: {success.newStock}
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

          <TextField
            label="Quantity to add"
            type="number"
            inputProps={{ step: '1', min: 1 }}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            fullWidth
          />

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

          <Button variant="contained" size="large" disabled={!valid || submitting} onClick={() => void handleSubmit()}>
            Add stock
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
