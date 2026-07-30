import { Box, Typography } from '@mui/material'

export default function ComingSoon({ title }: { title: string }) {
  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This screen is built in the next step.
      </Typography>
    </Box>
  )
}
