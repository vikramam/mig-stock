import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Alert, Stack } from '@mui/material'
import { parseRupeesToPaise } from '../../lib/supabase'
import { Size, SizeMode, formatSize } from '../../types'

export interface VariantDialogInitial {
  size_id: string | null
  size_label: string | null
  unit_price: number // paise
}

export interface VariantDialogValues {
  size_id: string | null
  size_label: string | null
  unitPricePaise: number
  openingStockQty: number
}

export default function VariantDialog({
  open,
  typeLabel,
  sizeMode,
  sizes,
  existingLabels,
  initial,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  typeLabel: string
  /** The parent type's size_mode — decides whether this dialog shows the size dropdown
   *  or a custom-label text field. Fixed for the type's lifetime once it has variants. */
  sizeMode: SizeMode
  sizes: Size[]
  /** Trimmed, lowercased labels already used by other variants under this type (the
   *  variant currently being edited, if any, is excluded) — used for an inline duplicate
   *  check before hitting the DB's own unique(type_id, size_label) constraint. */
  existingLabels: string[]
  initial?: VariantDialogInitial
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: VariantDialogValues) => void
}) {
  const [sizeId, setSizeId] = useState(initial?.size_id ?? '')
  const [sizeLabel, setSizeLabel] = useState(initial?.size_label ?? '')
  const [price, setPrice] = useState(initial ? String(initial.unit_price / 100) : '')
  const [openingStock, setOpeningStock] = useState('')

  useEffect(() => {
    if (open) {
      setSizeId(initial?.size_id ?? sizes[0]?.id ?? '')
      setSizeLabel(initial?.size_label ?? '')
      setPrice(initial ? String(initial.unit_price / 100) : '')
      setOpeningStock('')
    }
  }, [open, initial, sizes])

  const trimmedLabel = sizeLabel.trim()
  const labelDuplicate = sizeMode === 'freetext' && existingLabels.includes(trimmedLabel.toLowerCase())
  const sizeValid = sizeMode === 'dropdown' ? sizeId.length > 0 : trimmedLabel.length > 0 && !labelDuplicate
  const priceValid = price.trim().length > 0 && Number.isFinite(parseFloat(price)) && parseFloat(price) >= 0
  const valid = sizeValid && priceValid

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'Edit variant' : `Add variant — ${typeLabel}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {sizeMode === 'dropdown' ? (
            <TextField select label="Size" value={sizeId} onChange={(e) => setSizeId(e.target.value)} autoFocus fullWidth>
              {sizes.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {formatSize(s.value)}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Size label"
              placeholder="e.g. Extra thick"
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
              autoFocus
              fullWidth
              error={labelDuplicate}
              helperText={labelDuplicate ? 'This type already has a variant with that label.' : ' '}
            />
          )}
          <TextField
            label="Unit price (Rs.)"
            type="number"
            inputProps={{ step: '0.01', min: 0 }}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            fullWidth
          />
          {!initial && (
            <TextField
              placeholder="Opening stock (optional)"
              type="number"
              inputProps={{ 'aria-label': 'Opening stock (optional)', step: '1', min: 0 }}
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
              helperText="Leave blank to start at 0 — you can add stock later."
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() =>
            onSave({
              size_id: sizeMode === 'dropdown' ? sizeId : null,
              size_label: sizeMode === 'freetext' ? trimmedLabel : null,
              unitPricePaise: parseRupeesToPaise(price),
              openingStockQty: openingStock.trim() ? Math.max(0, Math.floor(Number(openingStock))) : 0
            })
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
