import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import { parseRupeesToPaise } from '../../lib/supabase'
import { SizeMode } from '../../types'

export interface TypeDialogValues {
  type_name: string
  default_discount: number // paise, per unit
  size_mode: SizeMode
}

export default function TypeDialog({
  open,
  productName,
  initial,
  hasVariants,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  productName: string
  initial?: TypeDialogValues
  /** True once this type has any variants — the app locks size_mode at that point rather
   *  than letting a type's variants end up split across both modes. */
  hasVariants: boolean
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: TypeDialogValues) => void
}) {
  const [typeName, setTypeName] = useState(initial?.type_name ?? '')
  const [discount, setDiscount] = useState(initial ? String(initial.default_discount / 100) : '')
  const [sizeMode, setSizeMode] = useState<SizeMode>(initial?.size_mode ?? 'dropdown')

  useEffect(() => {
    if (open) {
      setTypeName(initial?.type_name ?? '')
      setDiscount(initial ? String(initial.default_discount / 100) : '')
      setSizeMode(initial?.size_mode ?? 'dropdown')
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
            label="Type name"
            placeholder="e.g. Cruiser Clamp"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            autoFocus
            fullWidth
          />
          <Stack spacing={0.5}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={sizeMode}
              onChange={(_, value: SizeMode | null) => value && setSizeMode(value)}
              disabled={hasVariants}
            >
              <ToggleButton value="dropdown">Size list</ToggleButton>
              <ToggleButton value="freetext">Custom labels</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {hasVariants
                ? 'Locked once a type has variants — delete them first to change this.'
                : "Whether variants under this type pick a size from the list, or type a custom label (for sizes that don't fit inches)."}
            </Typography>
          </Stack>
          <TextField
            label="Default discount (Rs., per unit)"
            type="number"
            inputProps={{ step: '0.01', min: 0 }}
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
              default_discount: discount.trim() ? parseRupeesToPaise(discount) : 0,
              size_mode: sizeMode
            })
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
