import { useEffect, useRef, useState } from 'react'
import { Box, Paper, Typography, TextField, IconButton, Stack, Chip, Skeleton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { SendIcon, SmartToyIcon } from '../components/icons'
import BackButton from '../components/common/BackButton'
import { useAuth } from '../lib/auth'
import { chipUnselectedBg } from '../theme'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  isError?: boolean
}

const SUGGESTIONS = ['How much did I sell this week?', 'Who owes me money right now?', 'What are my low stock items?', 'Which size sells the most this month?']

export default function Chatbot() {
  const theme = useTheme()
  const unselectedBg = chipUnselectedBg(theme.palette.mode)
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const previousInteractionId = useRef<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending || !session) return

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: trimmed, previous_interaction_id: previousInteractionId.current })
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.error ?? 'Something went wrong.', isError: true }])
        return
      }

      previousInteractionId.current = data.interaction_id
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: "Couldn't reach the server — check your connection.", isError: true }])
    } finally {
      setSending(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', maxHeight: 700 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
        <BackButton />
        <Typography variant="h4">Ask MIG</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: '52px' }}>
        Ask plain-language questions about your sales, stock, and customers.
      </Typography>

      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          mb: 2,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, textAlign: 'center' }}>
            <SmartToyIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
              Try one of these, or type your own question below.
            </Typography>
            <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1}>
              {SUGGESTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  clickable
                  onClick={() => void sendMessage(s)}
                  variant="outlined"
                  color="primary"
                  sx={{ bgcolor: unselectedBg }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {messages.map((m, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Paper
              sx={{
                px: 1.75,
                py: 1,
                maxWidth: '80%',
                borderRadius: 3,
                border: '1px solid',
                borderColor: m.isError ? 'error.main' : m.role === 'user' ? 'transparent' : 'divider',
                backgroundImage:
                  m.role === 'user' && !m.isError
                    ? `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.primary.dark} 100%)`
                    : 'none',
                bgcolor: m.role === 'user' ? undefined : m.isError ? 'error.light' : 'background.paper',
                color: m.role === 'user' ? 'primary.contrastText' : 'text.primary'
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {m.text}
              </Typography>
            </Paper>
          </Box>
        ))}

        {sending && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Paper sx={{ px: 1.75, py: 1.25, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Stack spacing={0.5} sx={{ width: 120 }}>
                <Skeleton variant="text" width="90%" height={14} />
                <Skeleton variant="text" width="60%" height={14} />
              </Stack>
            </Paper>
          </Box>
        )}

        <div ref={bottomRef} />
      </Paper>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          p: 0.75,
          alignItems: 'center',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <TextField
          fullWidth
          variant="standard"
          placeholder="Ask about sales, stock, or customers…"
          inputProps={{ 'aria-label': 'Ask about sales, stock, or customers' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendMessage(input)
            }
          }}
          disabled={sending}
          InputProps={{ disableUnderline: true }}
          sx={{ px: 1 }}
        />
        <IconButton color="primary" onClick={() => void sendMessage(input)} disabled={sending || !input.trim()} aria-label="Send">
          <SendIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}
