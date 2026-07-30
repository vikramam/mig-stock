import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack } from '@mui/material'

export interface CustomerDialogValues {
  name: string
  phone: string
  note: string
}

export default function CustomerDialog({
  open,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: CustomerDialogValues) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setPhone('')
      setNote('')
    }
  }, [open])

  const valid = name.trim().length > 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add customer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() => onSave({ name: name.trim(), phone: phone.trim(), note: note.trim() })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
