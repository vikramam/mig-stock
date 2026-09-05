import { useState } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert, Stack } from '@mui/material'
import { BrandMarkIcon } from '../components/icons'
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
        // No bgcolor here — left transparent so the body's own background (solid color +
        // the dark-mode ambient glow, set globally in src/theme.ts) shows through.
        p: 2
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{ p: 4, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: (theme) => `inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px ${theme.palette.primary.main}66`
          }}
        >
          <BrandMarkIcon sx={{ color: 'primary.contrastText', fontSize: 28 }} />
        </Box>
        <Typography variant="h5" sx={{ mb: 0.5, textAlign: 'center' }}>
          Clamp Sales
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Sign in to continue
        </Typography>

        <Stack spacing={2} sx={{ width: '100%' }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            placeholder="Email"
            inputProps={{ 'aria-label': 'Email' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            fullWidth
            autoComplete="username"
          />
          <TextField
            placeholder="Password"
            inputProps={{ 'aria-label': 'Password' }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting || !email || !password}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
