import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack, Box, CircularProgress } from '@mui/material'
import ImageIcon from '@mui/icons-material/ImageSharp'
import { uploadProductImage } from '../../lib/supabase'

export interface ProductDialogValues {
  name: string
  image_url: string
}

export default function ProductDialog({
  open,
  initial,
  saving,
  error,
  onClose,
  onSave
}: {
  open: boolean
  initial?: ProductDialogValues
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (values: ProductDialogValues) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initial?.name ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setImageUrl(initial?.image_url ?? '')
      setUploadError(null)
    }
  }, [open, initial])

  const valid = name.trim().length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setUploadError(null)
    const { url, error: uploadErr } = await uploadProductImage(file)
    setUploading(false)

    if (uploadErr) {
      setUploadError(uploadErr)
      return
    }
    if (url) setImageUrl(url)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'Edit product' : 'Add product'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {uploadError && <Alert severity="error">{uploadError}</Alert>}

          <TextField
            label="Product name"
            placeholder="e.g. Clamp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
          />

          <Stack direction="row" gap={1.5} alignItems="center">
            {imageUrl ? (
              <Box
                component="img"
                src={imageUrl}
                sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
              />
            ) : (
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ImageIcon color="disabled" fontSize="small" />
              </Box>
            )}

            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={14} /> : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : imageUrl ? 'Change image' : 'Upload image'}
              </Button>
              {imageUrl && (
                <Button size="small" color="error" onClick={() => setImageUrl('')}>
                  Remove image
                </Button>
              )}
            </Stack>

            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => void handleFileChange(e)} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving || uploading}
          onClick={() => onSave({ name: name.trim(), image_url: imageUrl.trim() })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
