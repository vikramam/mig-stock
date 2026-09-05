import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack } from '@mui/material'
import { parseRupeesToPaise } from '../../lib/supabase'

export interface TypeDialogValues {
  type_name: string
  default_discount: number // paise, per unit
}

export default function TypeDialog({
  open,
  productName,
  initial,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  productName: string
  initial?: TypeDialogValues
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: TypeDialogValues) => void
}) {
  const [typeName, setTypeName] = useState(initial?.type_name ?? '')
  const [discount, setDiscount] = useState(initial ? String(initial.default_discount / 100) : '')

  useEffect(() => {
    if (open) {
      setTypeName(initial?.type_name ?? '')
      setDiscount(initial ? String(initial.default_discount / 100) : '')
    }
  }, [open, initial])

  const valid = typeName.trim().length > 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'Edit type' : `Add type — ${productName}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            placeholder="e.g. Cruiser Clamp"
            inputProps={{ 'aria-label': 'Type name' }}
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            placeholder="Default discount (Rs., per unit)"
            type="number"
            inputProps={{ 'aria-label': 'Default discount (Rs., per unit)', step: '0.01', min: 0 }}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            helperText='Applied per unit when "Apply discount" is clicked on New Sale. Leave blank for no discount.'
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() =>
            onSave({
              type_name: typeName.trim(),
              default_discount: discount.trim() ? parseRupeesToPaise(discount) : 0
            })
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
