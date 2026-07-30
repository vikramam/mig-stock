import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Switch,
  IconButton,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  Snackbar,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded'
import AddIcon from '@mui/icons-material/AddRounded'
import EditIcon from '@mui/icons-material/EditRounded'
import InventoryIcon from '@mui/icons-material/Inventory2Rounded'
import { supabase, formatMoney } from '../lib/supabase'
import { Product, ProductType, Variant, Width, Size, formatWidth, formatSize } from '../types'
import ProductDialog from '../components/stock/ProductDialog'
import TypeDialog from '../components/stock/TypeDialog'
import VariantDialog from '../components/stock/VariantDialog'

interface VariantRow extends Variant {
  sizes: { value: number } | null
}
interface TypeRow extends ProductType {
  widths: { value: number } | null
  variants: VariantRow[]
}
interface ProductRow extends Product {
  product_types: TypeRow[]
}

export default function StockManagement() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [widths, setWidths] = useState<Width[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const [productDialog, setProductDialog] = useState<{ open: boolean; editing?: Product }>({ open: false })
  const [typeDialog, setTypeDialog] = useState<{
    open: boolean
    productId?: string
    productName?: string
    editing?: ProductType
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
      .select('*, product_types(*, widths(value), variants(*, sizes(value)))')
      .order('created_at', { ascending: true })
      .order('created_at', { ascending: true, foreignTable: 'product_types' })
      .order('created_at', { ascending: true, foreignTable: 'product_types.variants' })

    if (error) setLoadError(error.message)
    else setProducts((data ?? []) as unknown as ProductRow[])
    setLoading(false)
  }

  async function loadMasters() {
    const [{ data: widthsData }, { data: sizesData }] = await Promise.all([
      supabase.from('widths').select('*').eq('active', true).order('value', { ascending: true }),
      supabase.from('sizes').select('*').eq('active', true).order('value', { ascending: true })
    ])
    setWidths((widthsData ?? []) as Width[])
    setSizes((sizesData ?? []) as Size[])
  }

  function isUniqueViolation(error: { code?: string } | null): boolean {
    return error?.code === '23505'
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
  async function saveType(values: { type_name: string; width_id: string }) {
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
  async function saveVariant(values: { size_id: string; unitPricePaise: number; openingStockQty: number }) {
    setSaving(true)
    setDialogError(null)
    const { editing, typeId } = variantDialog

    if (editing) {
      const { error } = await supabase
        .from('variants')
        .update({ size_id: values.size_id, unit_price: values.unitPricePaise })
        .eq('id', editing.id)
      setSaving(false)
      if (error) {
        setDialogError(isUniqueViolation(error) ? 'This type already has a variant with that size.' : error.message)
        return
      }
      setVariantDialog({ open: false })
      setToast({ message: 'Variant updated', severity: 'success' })
      void loadCatalog()
      return
    }

    const { data: inserted, error } = await supabase
      .from('variants')
      .insert({ type_id: typeId, size_id: values.size_id, unit_price: values.unitPricePaise })
      .select()
      .single()

    if (error) {
      setSaving(false)
      setDialogError(isUniqueViolation(error) ? 'This type already has a variant with that size.' : error.message)
      return
    }

    if (values.openingStockQty > 0) {
      const { error: stockError } = await supabase.rpc('add_stock', {
        p_variant_id: inserted.id,
        p_qty: values.openingStockQty,
        p_note: 'Opening stock',
        p_created_by: null
      })
      if (stockError) {
        setSaving(false)
        setDialogError(`Variant created, but opening stock failed: ${stockError.message}`)
        void loadCatalog()
        return
      }
    }

    setSaving(false)
    setVariantDialog({ open: false })
    setToast({ message: 'Variant added', severity: 'success' })
    void loadCatalog()
  }

  async function toggleVariantActive(variant: Variant) {
    const { error } = await supabase.from('variants').update({ active: !variant.active }).eq('id', variant.id)
    if (error) setToast({ message: error.message, severity: 'error' })
    else void loadCatalog()
  }

  const visibleProducts = showInactive ? products : products.filter((p) => p.active)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
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

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h4">Stock</Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <FormControlLabel
            control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
            label="Show inactive"
          />
          <Button variant="outlined" startIcon={<InventoryIcon />} onClick={() => navigate('/stock/add')}>
            Add stock
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

      {visibleProducts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.secondary">No products yet — add one to get started.</Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {visibleProducts.map((product) => {
          const visibleTypes = showInactive
            ? product.product_types
            : product.product_types.filter((t) => t.active)

          return (
            <Accordion key={product.id} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', pr: 1 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {product.name}
                    </Typography>
                    {!product.active && <Chip size="small" label="Inactive" />}
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.5} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => setProductDialog({ open: true, editing: product })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Switch
                      size="small"
                      checked={product.active}
                      onChange={() => void toggleProductActive(product)}
                    />
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {visibleTypes.map((type) => {
                    const visibleVariants = showInactive ? type.variants : type.variants.filter((v) => v.active)
                    return (
                      <Paper key={type.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography variant="subtitle2">
                              {type.type_name} · {formatWidth(type.widths?.value ?? 0)}
                            </Typography>
                            {!type.active && <Chip size="small" label="Inactive" />}
                          </Stack>
                          <Stack direction="row" alignItems="center" gap={0.5}>
                            <Button
                              size="small"
                              startIcon={<AddIcon fontSize="small" />}
                              onClick={() =>
                                setVariantDialog({
                                  open: true,
                                  typeId: type.id,
                                  typeLabel: `${product.name} / ${type.type_name}`,
                                  editing: undefined
                                })
                              }
                            >
                              Add variant
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => setTypeDialog({ open: true, productName: product.name, editing: type })}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <Switch size="small" checked={type.active} onChange={() => void toggleTypeActive(type)} />
                          </Stack>
                        </Stack>

                        {visibleVariants.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            No variants yet.
                          </Typography>
                        ) : (
                          <Table size="small" sx={{ mt: 1 }}>
                            <TableHead>
                              <TableRow>
                                <TableCell>Size</TableCell>
                                <TableCell align="right">Price</TableCell>
                                <TableCell align="right">Stock</TableCell>
                                <TableCell align="right">Active</TableCell>
                                <TableCell align="right">Edit</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {visibleVariants.map((variant) => (
                                <TableRow key={variant.id} sx={{ opacity: variant.active ? 1 : 0.5 }}>
                                  <TableCell>{formatSize(variant.sizes?.value ?? 0)}</TableCell>
                                  <TableCell align="right">
                                    <Typography variant="mono">{formatMoney(variant.unit_price)}</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography
                                      variant="mono"
                                      color={variant.current_stock <= 0 ? 'error.main' : 'text.primary'}
                                    >
                                      {variant.current_stock}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Switch
                                      size="small"
                                      checked={variant.active}
                                      onChange={() => void toggleVariantActive(variant)}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setVariantDialog({
                                          open: true,
                                          typeLabel: `${product.name} / ${type.type_name}`,
                                          editing: variant
                                        })
                                      }
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Paper>
                    )
                  })}

                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      setTypeDialog({ open: true, productId: product.id, productName: product.name, editing: undefined })
                    }
                  >
                    Add type
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Stack>

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
        widths={widths}
        initial={typeDialog.editing ? { type_name: typeDialog.editing.type_name, width_id: typeDialog.editing.width_id } : undefined}
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
        sizes={sizes}
        initial={
          variantDialog.editing
            ? { size_id: variantDialog.editing.size_id, unit_price: variantDialog.editing.unit_price }
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
