// Shared shimmer-skeleton building blocks, shaped like the real content they stand in
// for, so a screen's loading state roughly outlines what's about to appear instead of
// a generic gray box. Composed per-page rather than one "PageSkeleton" — each page's
// real layout is different (grid of tiles, table, form, cart), so the pieces here are
// deliberately small and mixed-and-matched at each call site.
import { Box, Grid, Paper, Skeleton, Stack } from '@mui/material'

export function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Grid container spacing={1.5} sx={{ mb: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={6} sm={3} key={i}>
          <Paper sx={{ p: 1.5, height: '100%' }}>
            <Skeleton variant="text" width="55%" height={16} />
            <Skeleton variant="text" width="75%" height={28} sx={{ mt: 0.5 }} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  )
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={height} />
    </Paper>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.75}>
        {Array.from({ length: rows }).map((_, r) => (
          <Stack key={r} direction="row" spacing={2} alignItems="center">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                variant="text"
                height={20}
                sx={{ flex: c === 0 ? '0 1 35%' : 1 }}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

export function FormSkeleton({ fields = 4, actionWidth = 120 }: { fields?: number; actionWidth?: number }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        {Array.from({ length: fields }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
        <Skeleton variant="rounded" width={actionWidth} height={40} />
      </Stack>
    </Paper>
  )
}

export function RowCardsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: rows }).map((_, i) => (
        <Paper key={i} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Skeleton variant="rounded" width={40} height={40} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="55%" height={20} />
            <Skeleton variant="text" width="35%" height={16} />
          </Box>
          <Skeleton variant="text" width={64} height={24} />
        </Paper>
      ))}
    </Stack>
  )
}
