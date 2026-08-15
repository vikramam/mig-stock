import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Stack,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControlLabel,
  Switch
} from '@mui/material'
import AddIcon from '@mui/icons-material/PersonAddAltSharp'
import EditIcon from '@mui/icons-material/EditSharp'
import DeleteIcon from '@mui/icons-material/DeleteSharp'
import RestoreIcon from '@mui/icons-material/RestoreFromTrashSharp'
import { supabase } from '../lib/supabase'
import { Customer } from '../types'
import { RowCardsSkeleton } from '../components/skeletons'
import CustomerDialog, { CustomerDialogValues } from '../components/sale/CustomerDialog'

export default function ManageCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  const [dialog, setDialog] = useState<{ open: boolean; editing?: Customer }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  useEffect(() => {
    void loadCustomers()
  }, [])

  async function loadCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true })
    if (error) setLoadError(error.message)
    else setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (!showDeleted && c.is_deleted) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    })
  }, [customers, search, showDeleted])

  async function saveCustomer(values: CustomerDialogValues) {
    setSaving(true)
    setDialogError(null)
    const payload = { name: values.name, phone: values.phone || null, note: values.note || null }
    const { editing } = dialog
    const { error } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload)

    setSaving(false)
    if (error) {
      setDialogError(error.message)
      return
    }
    setDialog({ open: false })
    setToast({ message: editing ? 'Customer updated' : 'Customer added', severity: 'success' })
    void loadCustomers()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const { count, error: countError } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', deleteTarget.id)

    if (countError) {
      setDeleting(false)
      setToast({ message: countError.message, severity: 'error' })
      return
    }

    const hasSales = (count ?? 0) > 0
    const { error } = hasSales
      ? await supabase.from('customers').update({ is_deleted: true }).eq('id', deleteTarget.id)
      : await supabase.from('customers').delete().eq('id', deleteTarget.id)

    setDeleting(false)
    if (error) {
      setToast({ message: error.message, severity: 'error' })
      return
    }
    setToast({
      message: hasSales
        ? `${deleteTarget.name} has past sales — hidden instead of deleted to keep sales history intact`
        : `${deleteTarget.name} had no sales — deleted permanently`,
      severity: 'success'
    })
    setDeleteTarget(null)
    void loadCustomers()
  }

  async function restoreCustomer(customer: Customer) {
    const { error } = await supabase.from('customers').update({ is_deleted: false }).eq('id', customer.id)
    if (error) {
      setToast({ message: error.message, severity: 'error' })
      return
    }
    setToast({ message: `Restored ${customer.name}`, severity: 'success' })
    void loadCustomers()
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Manage customers
        </Typography>
        <RowCardsSkeleton rows={5} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load customers: {loadError}
      </Alert>
    )
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
        gap={1.5}
      >
        <Typography variant="h4">Manage customers</Typography>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <FormControlLabel
            control={<Switch checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />}
            label="Show deleted"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ open: true, editing: undefined })}
          >
            Add new customer
          </Button>
        </Stack>
      </Stack>

      <TextField
        placeholder="Search by name or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {visibleCustomers.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">
            {customers.length === 0 ? 'No customers yet — add one to get started.' : 'No customers match your search.'}
          </Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {visibleCustomers.map((customer) => (
          <Paper key={customer.id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, opacity: customer.is_deleted ? 0.6 : 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                  {customer.name}
                </Typography>
                {customer.is_deleted && <Chip size="small" label="Deleted" />}
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {customer.phone || 'No phone'}
                {customer.note ? ` · ${customer.note}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
              {customer.is_deleted ? (
                <IconButton size="small" onClick={() => void restoreCustomer(customer)}>
                  <RestoreIcon fontSize="small" />
                </IconButton>
              ) : (
                <>
                  <IconButton size="small" onClick={() => setDialog({ open: true, editing: customer })}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(customer)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <CustomerDialog
        open={dialog.open}
        initial={dialog.editing ? { name: dialog.editing.name, phone: dialog.editing.phone ?? '', note: dialog.editing.note ?? '' } : undefined}
        saving={saving}
        error={dialogError}
        onClose={() => {
          setDialog({ open: false })
          setDialogError(null)
        }}
        onSave={saveCustomer}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete customer?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            If <strong>{deleteTarget?.name}</strong> has any recorded sales, they'll be hidden from the customer list and
            picker instead of deleted, so those sales keep showing their name — restorable later via the "Show deleted"
            filter. If they have no sales at all, they'll be deleted permanently.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)}>
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
