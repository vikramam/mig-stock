import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Chip, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { formatMoney } from '../../lib/supabase'
import { VariantWithContext, formatSize } from '../../types'
import { chipUnselectedBg, stockCellColor } from '../../theme'
import BottomSheet from '../common/BottomSheet'
import { CheckIcon, ChevronRightIcon, InventoryIcon } from '../icons'

interface ProductTypeSizePickerProps {
  variants: VariantWithContext[]
  /** Fired on every add-to-cart-style terminal pick (New Sale only — a size tap adds the
   *  item and the grid stays open for picking another). Manage Stock has no such
   *  "add" action; it relies on `onSelectionChange` below instead, so this is optional. */
  onPick?: (variant: VariantWithContext) => void
  /** Fired whenever the internally-resolved "current" variant changes (including after
   *  `variants` reloads with the same id, e.g. after a stock update) — Manage Stock uses
   *  this to mirror the selection into its own `selected` state, since unlike New Sale
   *  it needs a persistent selection to drive price/stock/undo UI below the picker. */
  onSelectionChange?: (variant: VariantWithContext | null) => void
  /** New Sale only — shows an amber count badge on a size cell already in the cart. */
  cartQtyByVariantId?: Map<string, number>
  /** Manage Stock's `?variant=` deep-link preselect (ported verbatim from its own
   *  `presetVariantId` effect). */
  presetVariantId?: string | null
  /** New Sale behavior: a type whose only variant is size 0 has no meaningful size
   *  dimension, so skip the size step and add it straight away. Manage Stock does not
   *  have this behavior today (it always shows the size step) — default false preserves
   *  that exactly; New Sale opts in. */
  autoAddSizeless?: boolean
  /** New Sale behavior: after firing onPick, clear the variant selection so the size
   *  grid stays visible for adding another size under the same type. Manage Stock wants
   *  the opposite (selection persists so price/stock/undo can be shown) — default false
   *  preserves that. */
  resetVariantAfterPick?: boolean
  /** Change this value (e.g. a tab key) to clear the product/type/size selection from
   *  outside — used by Manage Stock's Add/Update tab switch. Deliberately separate from
   *  a remount-via-`key`: that would also reset `presetApplied` and cause the
   *  `?variant=` deep-link preset to silently re-apply itself after being cleared. */
  resetToken?: string | number
  lowStockThreshold?: number
  /** Product/Type selection UI: horizontally-scrollable chips (default — Manage Stock)
   *  or a pair of dropdowns (New Sale wants this instead, since its product/type list
   *  can grow long and chips end up scrolling off-screen). Size selection is unaffected
   *  either way — it stays a grid, since sizes benefit from showing price/stock inline. */
  layout?: 'chips' | 'dropdown'
}

// Same tappable-row look as New Sale's customer picker (avatar circle + label/caption +
// chevron, opening a BottomSheet) — used for Product/Type when layout="dropdown".
function PickerFieldRow({
  valueLabel,
  placeholder,
  caption,
  onClick
}: {
  valueLabel: string | null
  placeholder: string
  caption: string
  onClick: () => void
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer'
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <InventoryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {valueLabel ?? placeholder}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
      </Box>
      <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
    </Box>
  )
}

export default function ProductTypeSizePicker({
  variants,
  onPick,
  onSelectionChange,
  cartQtyByVariantId,
  presetVariantId,
  autoAddSizeless = false,
  resetVariantAfterPick = false,
  resetToken,
  lowStockThreshold = 10,
  layout = 'chips'
}: ProductTypeSizePickerProps) {
  const theme = useTheme()
  const [pickProductId, setPickProductId] = useState('')
  const [pickTypeId, setPickTypeId] = useState('')
  const [pickVariantId, setPickVariantId] = useState('')
  const [presetApplied, setPresetApplied] = useState(false)
  const [productSheetOpen, setProductSheetOpen] = useState(false)
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)

  const productOptions = useMemo(() => {
    const map = new Map<string, string>()
    variants.forEach((v) => {
      if (!map.has(v.product_id)) map.set(v.product_id, v.product_name)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [variants])

  const typeOptions = useMemo(() => {
    if (!pickProductId) return []
    const map = new Map<string, { id: string; label: string }>()
    variants
      .filter((v) => v.product_id === pickProductId)
      .forEach((v) => {
        if (!map.has(v.type_id)) map.set(v.type_id, { id: v.type_id, label: v.type_name })
      })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [variants, pickProductId])

  const sizeOptions = useMemo(() => {
    if (!pickTypeId) return []
    return variants.filter((v) => v.type_id === pickTypeId).sort((a, b) => a.size - b.size)
  }, [variants, pickTypeId])

  // A type whose only variant is size 0 has no meaningful size dimension at all — skip
  // the size step for it entirely rather than making the user pick a single option.
  const isSizelessType = sizeOptions.length > 0 && sizeOptions.every((v) => v.size === 0)

  const selected = useMemo(() => sizeOptions.find((v) => v.id === pickVariantId) ?? null, [sizeOptions, pickVariantId])

  useEffect(() => {
    onSelectionChange?.(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // Ported verbatim from ManageStock's presetVariantId effect — applies once variants
  // have loaded and a match is found, then doesn't re-apply (a later manual pick
  // shouldn't be overridden if `variants` refetches).
  useEffect(() => {
    if (!presetVariantId || presetApplied) return
    const match = variants.find((v) => v.id === presetVariantId)
    if (match) {
      setPickProductId(match.product_id)
      setPickTypeId(match.type_id)
      setPickVariantId(match.id)
      setPresetApplied(true)
    }
  }, [variants, presetVariantId, presetApplied])

  // Only clear on an actual change to resetToken, not on mount — comparing the value
  // itself (rather than a plain "have we run yet" boolean) is what makes this safe
  // under StrictMode's dev-only double-invoke of effects: a boolean flip would read as
  // "already ran" on the synthetic second invocation and clear a just-applied
  // `?variant=` deep-link preset before it ever reached the screen.
  const prevResetTokenRef = useRef(resetToken)
  useEffect(() => {
    if (prevResetTokenRef.current === resetToken) return
    prevResetTokenRef.current = resetToken
    setPickProductId('')
    setPickTypeId('')
    setPickVariantId('')
  }, [resetToken])

  function handleProductPick(id: string) {
    setPickProductId(id)
    setPickTypeId('')
    setPickVariantId('')
  }

  function handleTypePick(id: string) {
    setPickTypeId(id)
    setPickVariantId('')

    if (!autoAddSizeless) return
    // Deliberately NOT resetting pickTypeId here — sizeOptions/isSizelessType are both
    // derived from it, so clearing it would make the size grid reappear (empty,
    // disabled) instead of staying hidden. Leaving Type selected also matches how the
    // normal sized flow keeps Product/Type selected after picking a size.
    const optionsForType = variants.filter((v) => v.type_id === id)
    if (optionsForType.length > 0 && optionsForType.every((v) => v.size === 0)) {
      onPick?.(optionsForType[0])
    }
  }

  function handleSizePick(id: string) {
    setPickVariantId(id)
    if (!resetVariantAfterPick) return
    const variant = sizeOptions.find((v) => v.id === id)
    if (variant) {
      onPick?.(variant)
      setPickVariantId('')
    }
  }

  const unselectedBg = chipUnselectedBg(theme.palette.mode)
  const selectedProductName = productOptions.find((p) => p.id === pickProductId)?.name ?? null
  const selectedTypeLabel = typeOptions.find((t) => t.id === pickTypeId)?.label ?? null

  return (
    <>
      <Stack spacing={2}>
        {layout === 'dropdown' ? (
          <PickerFieldRow
            valueLabel={selectedProductName}
            placeholder="Select product"
            caption="Tap to choose product"
            onClick={() => setProductSheetOpen(true)}
          />
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Product
            </Typography>
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {productOptions.map((p) => {
                const isSelected = p.id === pickProductId
                return (
                  <Chip
                    key={p.id}
                    label={p.name}
                    clickable
                    onClick={() => handleProductPick(p.id)}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color="primary"
                    sx={{ flexShrink: 0, ...(isSelected ? {} : { bgcolor: unselectedBg }) }}
                  />
                )
              })}
            </Stack>
          </Box>
        )}

        {pickProductId &&
          (layout === 'dropdown' ? (
            <PickerFieldRow
              valueLabel={selectedTypeLabel}
              placeholder="Select type"
              caption="Tap to choose type"
              onClick={() => setTypeSheetOpen(true)}
            />
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Type
              </Typography>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                {typeOptions.map((t) => {
                  const isSelected = t.id === pickTypeId
                  return (
                    <Chip
                      key={t.id}
                      label={t.label}
                      clickable
                      onClick={() => handleTypePick(t.id)}
                      variant={isSelected ? 'filled' : 'outlined'}
                      color="primary"
                      sx={{ flexShrink: 0, ...(isSelected ? {} : { bgcolor: unselectedBg }) }}
                    />
                  )
                })}
              </Stack>
            </Box>
          ))}

        {pickTypeId && !isSizelessType && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Pick a size</Typography>
              <Typography variant="caption" color="text.secondary">
                {sizeOptions.length} sizes
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1
              }}
            >
              {sizeOptions.map((v) => {
                const cartQty = cartQtyByVariantId?.get(v.id) ?? 0
                const isPicked = v.id === pickVariantId
                return (
                  <Paper
                    key={v.id}
                    variant="outlined"
                    onClick={() => handleSizePick(v.id)}
                    sx={{
                      position: 'relative',
                      p: 1,
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderColor: isPicked || cartQty > 0 ? 'primary.main' : 'divider',
                      bgcolor: isPicked || cartQty > 0 ? 'rgba(201,122,43,0.1)' : 'background.paper'
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatSize(v.size)}</Typography>
                    <Typography variant="mono" sx={{ fontSize: '0.65rem', opacity: 0.75, display: 'block' }}>
                      {formatMoney(v.unit_price)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={stockCellColor(v.current_stock, lowStockThreshold)}
                      sx={{ fontSize: '0.6rem' }}
                    >
                      {v.current_stock <= 0 ? 'Out of stock' : `${v.current_stock} in stock`}
                    </Typography>
                    {cartQty > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: '#1B1710',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {cartQty}
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Box>
          </Box>
        )}
      </Stack>

      {layout === 'dropdown' && (
        <>
          <BottomSheet open={productSheetOpen} onClose={() => setProductSheetOpen(false)} title="Choose product">
            <List sx={{ pt: 0 }}>
              {productOptions.map((p) => (
                <ListItemButton
                  key={p.id}
                  selected={p.id === pickProductId}
                  onClick={() => {
                    handleProductPick(p.id)
                    setProductSheetOpen(false)
                  }}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemText primary={p.name} />
                  {p.id === pickProductId && (
                    <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
                      <CheckIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                </ListItemButton>
              ))}
            </List>
          </BottomSheet>

          <BottomSheet open={typeSheetOpen} onClose={() => setTypeSheetOpen(false)} title="Choose type">
            <List sx={{ pt: 0 }}>
              {typeOptions.map((t) => (
                <ListItemButton
                  key={t.id}
                  selected={t.id === pickTypeId}
                  onClick={() => {
                    handleTypePick(t.id)
                    setTypeSheetOpen(false)
                  }}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemText primary={t.label} />
                  {t.id === pickTypeId && (
                    <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
                      <CheckIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                </ListItemButton>
              ))}
            </List>
          </BottomSheet>
        </>
      )}
    </>
  )
}
