import { useEffect, useState } from 'react'
import { Stack, IconButton, TextField } from '@mui/material'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'

// Quantities are always whole units (no fractional stock). The text field keeps its own
// local string while typing — clamping on every keystroke (as a plain controlled number
// input would) makes it impossible to clear "1" and type a different number on mobile,
// since the value snaps back to 1 the instant the field goes empty.
export default function QtyStepper({
  qty,
  onChange,
  size = 'small'
}: {
  qty: number
  onChange: (qty: number) => void
  size?: 'small' | 'medium'
}) {
  const [text, setText] = useState(String(qty))

  useEffect(() => {
    setText(String(qty))
  }, [qty])

  function commit(raw: string) {
    const parsed = Math.floor(Number(raw))
    const clamped = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    setText(String(clamped))
    if (clamped !== qty) onChange(clamped)
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <IconButton size={size} disabled={qty <= 1} onClick={() => commit(String(qty - 1))}>
        <RemoveRoundedIcon fontSize="small" />
      </IconButton>
      <TextField
        type="text"
        size={size}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { textAlign: 'center', width: 36 } }}
      />
      <IconButton size={size} onClick={() => commit(String(qty + 1))}>
        <AddRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
