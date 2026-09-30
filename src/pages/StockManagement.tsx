import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Switch,
  IconButton,
  FormControlLabel,
  Chip,
  Stack,
  Snackbar,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import EditIcon from '@mui/icons-material/EditSharp'
import { AddIcon, DeleteIcon, InventoryIcon, ChevronRightIcon, BackIcon as ArrowBackIcon } from '../components/icons'
import { supabase, formatMoney } from '../lib/supabase'
import { listRowSx } from '../theme'
import { Product, ProductType, Variant, Size, SizeMode, variantSizeText } from '../types'
import ProductDialog from '../components/stock/ProductDialog'
import TypeDialog from '../components/stock/TypeDialog'
import VariantDialog from '../components/stock/VariantDialog'
import { RowCardsSkeleton } from '../components/skeletons'

interface VariantRow extends Variant {
  sizes: { value: number } | null
}
interface TypeRow extends ProductType {
  variants: VariantRow[]
}
interface ProductRow extends Product {
  product_types: TypeRow[]
}

// Catalog's native-mobile drill-down: products -> types -> variants, all read from the
// SAME already-loaded `products` tree (see loadCatalog below) — no per-level fetches.
type CatalogView = 'products' | 'types' | 'variants'

export default function StockManagement() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [showDeletedVariants, setShowDeletedVariants] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const [view, setView] = useState<CatalogView>('products')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)

  const [deleteVariantTarget, setDeleteVariantTarget] = useState<{ variant: VariantRow; typeLabel: string } | null>(null)
  const [deletingVariant, setDeletingVariant] = useState(false)

  const [productDialog, setProductDialog] = useState<{ open: boolean; editing?: Product }>({ open: false })
  const [typeDialog, setTypeDialog] = useState<{
    open: boolean
    productId?: string
    productName?: string
    editing?: ProductType
    hasVariants?: boolean
  }>({ open: false })
  const [variantDialog, setVariantDialog] = useState<{
    open: boolean
    typeId?: string
    typeLabel?: string
    editing?: Variant
  }>({ open: false })

  useEffect(() => {
    void loadCatalog()
    void loadMasters()
  }, [])

  async function loadCatalog() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, product_types(*, variants(*, sizes(value)))')
      .order('created_at', { ascending: true })
      .order('created_at', { ascending: true, foreignTable: 'product_types' })
      .order('created_at', { ascending: true, foreignTable: 'product_types.variants' })

    if (error) setLoadError(error.message)
    else setProducts((data ?? []) as unknown as ProductRow[])
    setLoading(false)
  }

  async function loadMasters() {
    const { data: sizesData } = await supabase.from('sizes').select('*').eq('active', true).order('value', { ascending: true })
    setSizes((sizesData ?? []) as Size[])
  }

  function isUniqueViolation(error: { code?: string } | null): boolean {
    return error?.code === '23505'
  }

  // ---------- Navigation ----------
  function openTypes(productId: string) {
    setSelectedProductId(productId)
    setSelectedTypeId(null)
    setView('types')
  }

  function openVariants(typeId: string) {
    setSelectedTypeId(typeId)
    setView('variants')
  }

  function backToProducts() {
    setView('products')
    setSelectedProductId(null)
    setSelectedTypeId(null)
  }

  function backToTypes() {
    setView('types')
    setSelectedTypeId(null)
  }

  // ---------- Product ----------
  async function saveProduct(values: { name: string; image_url: string }) {
    setSaving(true)
    setDialogError(null)
    const { editing } = productDialog
    const payload = { name: values.name, image_url: values.image_url || null }
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload)

    setSaving(false)
    if (error) {
      setDialogError(error.message)
      return
    }
    setProductDialog({ open: false })
    setToast({ message: editing ? 'Product updated' : 'Product added', severity: 'success' })
    void loadCatalog()
  }

  async function toggleProductActive(product: Product) {
    const { error } = await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
    if (error) setToast({ message: error.message, severity: 'error' })
    else void loadCatalog()
  }

  // ---------- Product type ----------
  async function saveType(values: { type_name: string; default_discount: number; size_mode: SizeMode }) {
    setSaving(true)
    setDialogError(null)
    const { editing, productId } = typeDialog
    const { error } = editing
      ? await supabase.from('product_types').update(values).eq('id', editing.id)
      : await supabase.from('product_types').insert({ product_id: productId, ...values })

    setSaving(false)
    if (error) {
      setDialogError(
        isUniqueViolation(error) ? 'This product already has a type with that name.' : error.message
      )
      return
    }
    setTypeDialog({ open: false })
    setToast({ message: editing ? 'Type updated' : 'Type added', severity: 'success' })
    void loadCatalog()
  }

  async function toggleTypeActive(type: ProductType) {
    const { error } = await supabase.from('product_types').update({ active: !type.active }).eq('id', type.id)
    if (error) setToast({ message: error.message, severity: 'error' })
    else void loadCatalog()
  }

  // ---------- Variant ----------
  async function saveVariant(values: {
    size_id: string | null
    size_label: string | null
    unitPricePaise: number
    openingStockQty: number
  }) {
    setSaving(true)
    setDialogError(null)
    const { editing, typeId } = variantDialog
    const duplicateMessage = values.size_id
      ? 'This type already has a variant with that size.'
      : 'This type already has a variant with that label.'

    if (editing) {
      const { error } = await supabase
        .from('variants')
        .update({ size_id: values.size_id, size_label: values.size_label, unit_price: values.unitPricePaise })
        .eq('id', editing.id)
      setSaving(false)
      if (error) {
        setDialogError(isUniqueViolation(error) ? duplicateMessage : error.message)
        return
      }
      setVariantDialog({ open: false })
      setToast({ message: 'Variant updated', severity: 'success' })
      void loadCatalog()
      return
    }

    // The unique (type_id, size_id)/(type_id, size_label) constraints mean re-adding a
    // size or label that was previously soft-deleted would otherwise fail as a duplicate
    // — check for that case first and revive the existing row (with the newly entered
    // price) instead of inserting.
    let lookupQuery = supabase.from('variants').select('id, is_deleted').eq('type_id', typeId).limit(1)
    lookupQuery = values.size_id ? lookupQuery.eq('size_id', values.size_id) : lookupQuery.eq('size_label', values.size_label)
    const { data: existingRows, error: lookupError } = await lookupQuery

    if (lookupError) {
      setSaving(false)
      setDialogError(lookupError.message)
      return
    }

    const existing = existingRows?.[0] as { id: string; is_deleted: boolean } | undefined
    if (existing && !existing.is_deleted) {
      setSaving(false)
      setDialogError(duplicateMessage)
      return
    }

    let variantId: string
    const reviving = !!existing

    if (existing) {
      const { error } = await supabase
        .from('variants')
        .update({ is_deleted: false, active: true, unit_price: values.unitPricePaise })
        .eq('id', existing.id)
      if (error) {
        setSaving(false)
        setDialogError(error.message)
        return
      }
      variantId = existing.id
    } else {
      const { data: inserted, error } = await supabase
        .from('variants')
        .insert({ type_id: typeId, size_id: values.size_id, size_label: values.size_label, unit_price: values.unitPricePaise })
        .select()
        .single()

      if (error) {
        setSaving(false)
        setDialogError(isUniqueViolation(error) ? duplicateMessage : error.message)
        return
      }
      variantId = inserted.id
    }

    if (values.openingStockQty > 0) {
      const { error: stockError } = await supabase.rpc('add_stock', {
        p_variant_id: variantId,
        p_qty: values.openingStockQty,
        p_note: reviving ? 'Opening stock (variant restored)' : 'Opening stock',
        p_created_by: null
      })
      if (stockError) {
        setSaving(false)
        setDialogError(`Variant saved, but opening stock failed: ${stockError.message}`)
        void loadCatalog()
        return
      }
    }

    setSaving(false)
    setVariantDialog({ open: false })
    setToast({ message: reviving ? 'Variant restored and updated' : 'Variant added', severity: 'success' })
    void loadCatalog()
  }

  async function confirmDeleteVariant() {
    if (!deleteVariantTarget) return
    setDeletingVariant(true)
    const { error } = await supabase
      .from('variants')
      .update({ is_deleted: true })
      .eq('id', deleteVariantTarget.variant.id)
    setDeletingVariant(false)
    if (error) {
      setToast({ message: error.message, severity: 'error' })
      return
    }
    setToast({ message: 'Variant deleted', severity: 'success' })
    setDeleteVariantTarget(null)
    void loadCatalog()
  }

  async function toggleVariantActive(variant: Variant) {
    const { error } = await supabase.from('variants').update({ active: !variant.active }).eq('id', variant.id)
    if (error) setToast({ message: error.message, severity: 'error' })
    else void loadCatalog()
  }

  const visibleProducts = showInactive ? products : products.filter((p) => p.active)

  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) ?? null : null
  const visibleTypes = selectedProduct
    ? showInactive
      ? selectedProduct.product_types
      : selectedProduct.product_types.filter((t) => t.active)
    : []

  const selectedType = selectedTypeId ? selectedProduct?.product_types.find((t) => t.id === selectedTypeId) ?? null : null
  const visibleVariants = selectedType
    ? selectedType.variants.filter((v) => {
        if (!showInactive && !v.active) return false
        if (!showDeletedVariants && v.is_deleted) return false
        return true
      })
    : []
  const selectedTypeLabel = selectedProduct && selectedType ? `${selectedProduct.name} / ${selectedType.type_name}` : ''
  // Existing (non-deleted, other-than-the-one-being-edited) size labels under the
  // selected type — VariantDialog's inline duplicate check for 'freetext'-mode types.
  const existingLabels = selectedType
    ? selectedType.variants
        .filter((v) => !v.is_deleted && v.id !== variantDialog.editing?.id)
        .map((v) => (v.size_label ?? '').trim().toLowerCase())
        .filter(Boolean)
    : []

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Catalog
        </Typography>
        <RowCardsSkeleton rows={5} />
      </Box>
    )
  }

  if (loadError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load catalog: {loadError}
      </Alert>
    )
  }

  const showInactiveToggle = (
    <FormControlLabel
      control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
      label="Show inactive"
    />
  )

  return (
    <Box>
      {/* ---------- Header (per drill-down level) ---------- */}
      {view === 'products' && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
          gap={1.5}
        >
          <Typography variant="h4">Catalog</Typography>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {showInactiveToggle}
            <Button variant="outlined" startIcon={<InventoryIcon />} onClick={() => navigate('/stock/add')}>
              Manage stock
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setProductDialog({ open: true, editing: undefined })}
            >
              Add product
            </Button>
          </Stack>
        </Stack>
      )}

      {view === 'types' && selectedProduct && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
          gap={1.5}
        >
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            <IconButton onClick={backToProducts} aria-label="Back to products">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" noWrap>
              {selectedProduct.name}
            </Typography>
            {!selectedProduct.active && <Chip size="small" label="Inactive" />}
          </Stack>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {showInactiveToggle}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                setTypeDialog({
                  open: true,
                  productId: selectedProduct.id,
                  productName: selectedProduct.name,
                  editing: undefined,
                  hasVariants: false
                })
              }
            >
              Add type
            </Button>
          </Stack>
        </Stack>
      )}

      {view === 'variants' && selectedProduct && selectedType && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
          gap={1.5}
        >
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            <IconButton onClick={backToTypes} aria-label="Back to types">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" noWrap>
              {selectedProduct.name} / {selectedType.type_name}
            </Typography>
            {!selectedType.active && <Chip size="small" label="Inactive" />}
          </Stack>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {showInactiveToggle}
            <FormControlLabel
              control={
                <Switch checked={showDeletedVariants} onChange={(e) => setShowDeletedVariants(e.target.checked)} />
              }
              label="Show deleted variants"
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                setVariantDialog({
                  open: true,
                  typeId: selectedType.id,
                  typeLabel: selectedTypeLabel,
                  editing: undefined
                })
              }
            >
              Add variant
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ---------- Body (per drill-down level) ---------- */}
      {view === 'products' && (
        <>
          {visibleProducts.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">No products yet — add one to get started.</Typography>
            </Paper>
          )}
          <Stack spacing={1.25}>
            {visibleProducts.map((product) => {
              const visibleTypeCount = product.product_types.filter((t) => showInactive || t.active).length
              return (
                <Box
                  key={product.id}
                  onClick={() => openTypes(product.id)}
                  sx={{ ...listRowSx(theme), cursor: 'pointer', opacity: product.active ? 1 : 0.6 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                        {product.name}
                      </Typography>
                      {!product.active && <Chip size="small" label="Inactive" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {visibleTypeCount} type{visibleTypeCount === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => setProductDialog({ open: true, editing: product })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Switch size="small" checked={product.active} onChange={() => void toggleProductActive(product)} />
                  </Stack>
                  <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                </Box>
              )
            })}
          </Stack>
        </>
      )}

      {view === 'types' && selectedProduct && (
        <>
          {visibleTypes.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">No types yet — add one to get started.</Typography>
            </Paper>
          )}
          <Stack spacing={1.25}>
            {visibleTypes.map((type) => {
              const visibleVariantCount = type.variants.filter(
                (v) => (showInactive || v.active) && (showDeletedVariants || !v.is_deleted)
              ).length
              return (
                <Box
                  key={type.id}
                  onClick={() => openVariants(type.id)}
                  sx={{ ...listRowSx(theme), cursor: 'pointer', opacity: type.active ? 1 : 0.6 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                        {type.type_name}
                      </Typography>
                      {!type.active && <Chip size="small" label="Inactive" />}
                      {type.default_discount > 0 && (
                        <Chip size="small" variant="outlined" label={`Discount ${formatMoney(type.default_discount)}/unit`} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {visibleVariantCount} variant{visibleVariantCount === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setTypeDialog({
                          open: true,
                          productName: selectedProduct.name,
                          editing: type,
                          hasVariants: type.variants.length > 0
                        })
                      }
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Switch size="small" checked={type.active} onChange={() => void toggleTypeActive(type)} />
                  </Stack>
                  <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                </Box>
              )
            })}
          </Stack>
        </>
      )}

      {view === 'variants' && selectedProduct && selectedType && (
        <>
          {visibleVariants.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">No variants yet.</Typography>
            </Paper>
          )}
          <Stack spacing={1.25}>
            {visibleVariants.map((variant) => (
              <Box
                key={variant.id}
                sx={{ ...listRowSx(theme), opacity: variant.active && !variant.is_deleted ? 1 : 0.6 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {variantSizeText({ size: variant.sizes?.value ?? null, size_label: variant.size_label })}
                    </Typography>
                    {variant.is_deleted && <Chip size="small" label="Deleted" />}
                  </Stack>
                  <Typography
                    variant="mono"
                    color={variant.current_stock <= 0 ? 'error.main' : 'text.secondary'}
                    sx={{ fontSize: 14 }}
                  >
                    Stock {variant.current_stock} · {formatMoney(variant.unit_price)}
                  </Typography>
                </Box>
                {!variant.is_deleted && (
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                    <Switch size="small" checked={variant.active} onChange={() => void toggleVariantActive(variant)} />
                    <IconButton
                      size="small"
                      onClick={() =>
                        setVariantDialog({
                          open: true,
                          typeLabel: selectedTypeLabel,
                          editing: variant
                        })
                      }
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setDeleteVariantTarget({
                          variant,
                          typeLabel: selectedTypeLabel
                        })
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </>
      )}

      <ProductDialog
        open={productDialog.open}
        initial={
          productDialog.editing
            ? { name: productDialog.editing.name, image_url: productDialog.editing.image_url ?? '' }
            : undefined
        }
        saving={saving}
        error={dialogError}
        onClose={() => {
          setProductDialog({ open: false })
          setDialogError(null)
        }}
        onSave={saveProduct}
      />

      <TypeDialog
        open={typeDialog.open}
        productName={typeDialog.productName ?? ''}
        initial={
          typeDialog.editing
            ? {
                type_name: typeDialog.editing.type_name,
                default_discount: typeDialog.editing.default_discount,
                size_mode: typeDialog.editing.size_mode
              }
            : undefined
        }
        hasVariants={typeDialog.hasVariants ?? false}
        saving={saving}
        error={dialogError}
        onClose={() => {
          setTypeDialog({ open: false })
          setDialogError(null)
        }}
        onSave={saveType}
      />

      <VariantDialog
        open={variantDialog.open}
        typeLabel={variantDialog.typeLabel ?? ''}
        sizeMode={selectedType?.size_mode ?? 'dropdown'}
        sizes={sizes}
        existingLabels={existingLabels}
        initial={
          variantDialog.editing
            ? {
                size_id: variantDialog.editing.size_id,
                size_label: variantDialog.editing.size_label,
                unit_price: variantDialog.editing.unit_price
              }
            : undefined
        }
        saving={saving}
        error={dialogError}
        onClose={() => {
          setVariantDialog({ open: false })
          setDialogError(null)
        }}
        onSave={saveVariant}
      />

      <Dialog open={!!deleteVariantTarget} onClose={() => setDeleteVariantTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete variant?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deleteVariantTarget &&
              variantSizeText({
                size: deleteVariantTarget.variant.sizes?.value ?? null,
                size_label: deleteVariantTarget.variant.size_label
              })}{' '}
            of{' '}
            {deleteVariantTarget?.typeLabel} will be hidden from the catalog, New Sale, and Manage Stock — its stock and
            sales history are kept. Re-add the same size later via "Add variant" to bring it back with an updated price.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteVariantTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deletingVariant} onClick={() => void confirmDeleteVariant()}>
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
