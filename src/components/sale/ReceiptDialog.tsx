import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, CircularProgress, Stack, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseRounded'
import ShareIcon from '@mui/icons-material/IosShareRounded'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfRounded'
import { downloadBlob, receiptToPdfBlob, receiptToPngBlob, shareOrDownload } from '../../lib/receipt'
import { fetchReceiptData } from '../../lib/receiptData'
import Receipt, { ReceiptData } from './Receipt'

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Receipt
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ bgcolor: 'action.hover' }}>
        {loading && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        )}

        {!loading && loadError && <Alert severity="error">Failed to load receipt: {loadError}</Alert>}

        {!loading && actionError && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        {!loading && data && (
          <Stack sx={{ py: 2 }}>
            <Receipt ref={receiptRef} data={data} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button startIcon={<PictureAsPdfIcon />} disabled={!data || busy} onClick={() => void handleDownloadPdf()}>
          PDF
        </Button>
        <Button variant="contained" startIcon={<ShareIcon />} disabled={!data || busy} onClick={() => void handleShare()}>
          Share
        </Button>
      </DialogActions>
    </Dialog>
  )
}
