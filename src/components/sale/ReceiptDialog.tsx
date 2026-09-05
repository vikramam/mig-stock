import { useEffect, useRef, useState } from 'react'
import { Box, Button, Alert, Skeleton, Stack } from '@mui/material'
import ShareIcon from '@mui/icons-material/IosShareSharp'
import { FileDownloadIcon as PictureAsPdfIcon } from '../icons'
import { downloadBlob, receiptToPdfBlob, receiptToPngBlob, shareOrDownload } from '../../lib/receipt'
import { fetchReceiptData } from '../../lib/receiptData'
import Receipt, { ReceiptData } from './Receipt'
import BottomSheet from '../common/BottomSheet'

export default function ReceiptDialog({
  open,
  saleId,
  onClose
}: {
  open: boolean
  saleId: string | null
  onClose: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [data, setData] = useState<ReceiptData | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (open && saleId) void load(saleId)
  }, [open, saleId])

  async function load(id: string) {
    setLoading(true)
    setLoadError(null)
    setActionError(null)

    const { data: receiptData, error } = await fetchReceiptData(id)
    if (error) {
      setLoadError(error)
      setLoading(false)
      return
    }

    setData(receiptData)
    setLoading(false)
  }

  async function handleShare() {
    if (!receiptRef.current || !data) return
    setBusy(true)
    setActionError(null)
    try {
      const blob = await receiptToPngBlob(receiptRef.current)
      await shareOrDownload(blob, `${data.receiptNo}.png`, 'image/png', `Receipt ${data.receiptNo}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate receipt image')
    }
    setBusy(false)
  }

  async function handleDownloadPdf() {
    if (!receiptRef.current || !data) return
    setBusy(true)
    setActionError(null)
    try {
      const blob = await receiptToPdfBlob(receiptRef.current)
      downloadBlob(blob, `${data.receiptNo}.pdf`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate receipt PDF')
    }
    setBusy(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Sale complete">
      {loading && (
        // Mimics Receipt.tsx's own fixed white card (see that file for why it's
        // hardcoded rather than theme-driven) so the shimmer previews the right shape
        // in the right tone — a dark-mode skeleton tint would be invisible here.
        <Box sx={{ width: '100%', maxWidth: 380, mx: 'auto', bgcolor: '#FFFFFF', p: 3, borderRadius: 3 }}>
          <Stack spacing={1.5} alignItems="center">
            <Skeleton variant="text" width="60%" height={32} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
            <Skeleton variant="text" width="40%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
          </Stack>
          <Stack spacing={1.25} sx={{ mt: 3 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Stack key={i} direction="row" justifyContent="space-between">
                <Skeleton variant="text" width="50%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                <Skeleton variant="text" width="20%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {!loading && loadError && <Alert severity="error">Failed to load receipt: {loadError}</Alert>}

      {!loading && actionError && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {!loading && data && (
        <Stack sx={{ py: 1 }}>
          <Receipt ref={receiptRef} data={data} />
        </Stack>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button fullWidth onClick={onClose}>
          Close
        </Button>
        <Button fullWidth startIcon={<PictureAsPdfIcon />} disabled={!data || busy} onClick={() => void handleDownloadPdf()}>
          PDF
        </Button>
        <Button fullWidth variant="contained" startIcon={<ShareIcon />} disabled={!data || busy} onClick={() => void handleShare()}>
          Share
        </Button>
      </Stack>
    </BottomSheet>
  )
}
