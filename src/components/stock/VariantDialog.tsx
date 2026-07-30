import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Alert, Stack } from '@mui/material'
import { parseRupeesToPaise } from '../../lib/supabase'
import { Size, formatSize } from '../../types'

export interface VariantDialogInitial {
  size_id: string
  unit_price: number // paise
}

export interface VariantDialogValues {
  size_id: string
  unitPricePaise: number
  openingStockQty: number
}

export default function VariantDialog({
  open,
  typeLabel,
  sizes,
  initial,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  typeLabel: string
  sizes: Size[]
  initial?: VariantDialogInitial
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: VariantDialogValues) => void
}) {
  const [sizeId, setSizeId] = useState(initial?.size_id ?? '')
  const [price, setPrice] = useState(initial ? String(initial.unit_price / 100) : '')
  const [openingStock, setOpeningStock] = useState('')

  useEffect(() => {
    if (open) {
      setSizeId(initial?.size_id ?? sizes[0]?.id ?? '')
      setPrice(initial ? String(initial.unit_price / 100) : '')
      setOpeningStock('')
    }
  }, [open, initial, sizes])

  const priceValid = price.trim().length > 0 && Number.isFinite(parseFloat(price)) && parseFloat(price) >= 0
  const valid = sizeId.length > 0 && priceValid

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'Edit variant' : `Add variant — ${typeLabel}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Size" value={sizeId} onChange={(e) => setSizeId(e.target.value)} autoFocus fullWidth>
            {sizes.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {formatSize(s.value)}
              </MenuItem>
            ))}
          </TextField>
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
              label="Opening stock (optional)"
              type="number"
              inputProps={{ step: '1', min: 0 }}
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
              size_id: sizeId,
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
