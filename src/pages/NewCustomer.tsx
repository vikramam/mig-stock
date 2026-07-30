import { useState } from 'react'
import { Box, Typography, Paper, TextField, Button, Stack, Alert } from '@mui/material'
import { supabase } from '../lib/supabase'

export default function NewCustomer() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const valid = name.trim().length > 0

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('customers')
      .insert({ name: name.trim(), phone: phone.trim() || null, note: note.trim() || null })

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }

    setSuccess(`Added ${name.trim()}`)
    setName('')
    setPhone('')
    setNote('')
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        New customer
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add a customer record for use on sales and receipts.
      </Typography>

      <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
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

          <Button variant="contained" size="large" disabled={!valid || submitting} onClick={() => void handleSubmit()}>
            Add customer
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
