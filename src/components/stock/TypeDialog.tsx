import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Alert, Stack } from '@mui/material'
import { Width, formatWidth } from '../../types'

export interface TypeDialogValues {
  type_name: string
  width_id: string
}

export default function TypeDialog({
  open,
  productName,
  widths,
  initial,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  productName: string
  widths: Width[]
  initial?: TypeDialogValues
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: TypeDialogValues) => void
}) {
  const [typeName, setTypeName] = useState(initial?.type_name ?? '')
  const [widthId, setWidthId] = useState(initial?.width_id ?? '')

  useEffect(() => {
    if (open) {
      setTypeName(initial?.type_name ?? '')
      setWidthId(initial?.width_id ?? widths[0]?.id ?? '')
    }
  }, [open, initial, widths])

  const valid = typeName.trim().length > 0 && widthId.length > 0

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
          <TextField select label="Width" value={widthId} onChange={(e) => setWidthId(e.target.value)} fullWidth>
            {widths.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {formatWidth(w.value)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() => onSave({ type_name: typeName.trim(), width_id: widthId })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
