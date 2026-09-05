import { IconButton } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { BackIcon } from '../icons'

// Goes to whatever the user actually came from (Dashboard tile, hamburger menu, or a
// deep link like Low Stock's "Add stock") rather than a hardcoded route — most of these
// pages have more than one entry point, so browser-back is the only destination that's
// always correct.
export default function BackButton() {
  const navigate = useNavigate()
  return (
    <IconButton
      onClick={() => navigate(-1)}
      aria-label="Go back"
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, flexShrink: 0 }}
    >
      <BackIcon />
    </IconButton>
  )
}
