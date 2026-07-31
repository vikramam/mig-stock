import { useEffect, useRef, useState } from 'react'
import { Box, Paper, Typography, TextField, IconButton, Stack, Chip, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/SendSharp'
import SmartToyIcon from '@mui/icons-material/SmartToySharp'
import { useAuth } from '../lib/auth'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  isError?: boolean
}

const SUGGESTIONS = ['How much did I sell this week?', 'Who owes me money right now?', 'What are my low stock items?', 'Which size sells the most this month?']

export default function Chatbot() {
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
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Ask MIG
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ask plain-language questions about your sales, stock, and customers.
      </Typography>

      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
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
                <Chip key={s} label={s} onClick={() => void sendMessage(s)} sx={{ cursor: 'pointer' }} />
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
                border: '1px solid',
                borderColor: m.isError ? 'error.main' : 'divider',
                bgcolor: m.role === 'user' ? 'primary.main' : m.isError ? 'error.light' : 'background.default',
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
            <Paper sx={{ px: 1.75, py: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
              <CircularProgress size={16} />
            </Paper>
          </Box>
        )}

        <div ref={bottomRef} />
      </Paper>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          placeholder="Ask about sales, stock, or customers…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendMessage(input)
            }
          }}
          disabled={sending}
        />
        <IconButton color="primary" onClick={() => void sendMessage(input)} disabled={sending || !input.trim()} aria-label="Send">
          <SendIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}
