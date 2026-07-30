import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack } from '@mui/material'

export interface TypeDialogValues {
  type_name: string
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

  useEffect(() => {
    if (open) setTypeName(initial?.type_name ?? '')
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!valid || saving} onClick={() => onSave({ type_name: typeName.trim() })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
