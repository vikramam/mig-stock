import { useState } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert, Stack } from '@mui/material'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)
    if (error) setError(error.message)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{ p: 4, width: '100%', maxWidth: 360, border: '1px solid', borderColor: 'divider' }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            color: 'primary.contrastText',
            fontSize: 18,
            mb: 2
          }}
        >
          M
        </Box>
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          MIG Stock
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to continue
        </Typography>

        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            fullWidth
            autoComplete="username"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting || !email || !password}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
