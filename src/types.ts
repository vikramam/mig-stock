export interface Product {
  id: string
  name: string
  image_url: string | null
  active: boolean
}

export type SizeMode = 'dropdown' | 'freetext'

export interface ProductType {
  id: string
  product_id: string
  type_name: string
  active: boolean
  default_discount: number // paise, per unit — applied via "Apply discount" on New Sale
  size_mode: SizeMode // 'dropdown': variants pick from `sizes`. 'freetext': variants type
    // a custom label (variants.size_label) instead — for types that don't fit a
    // numeric-inches size. Locked once the type has any variants (app-enforced).
}

export interface Size {
  id: string
  value: number // plain inches, e.g. 1.5, 2, 2.5 ... 17 — append unit only in UI
  active: boolean
}

// Displays a size value with its unit, e.g. formatSize(2) -> '2"'
export function formatSize(value: number): string {
  return `${value}"`
}

export interface Variant {
  id: string
  type_id: string
  size_id: string | null // set for 'dropdown'-mode types
  size_label: string | null // set for 'freetext'-mode types — exactly one of the two is set
  unit_price: number // paise
  current_stock: number
  active: boolean
  is_deleted: boolean
}

export interface LowStockRow {
  variant_id: string
  product_name: string
  type_name: string
  size: number | null
  size_label: string | null
  current_stock: number
  unit_price: number
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  note: string | null
  is_deleted: boolean
}

export type PaymentStatus = 'paid' | 'pending'
export type SaleStatus = 'active' | 'cancelled'

export interface Sale {
  id: string
  receipt_no: string
  customer_id: string | null
  total: number
  amount_paid: number
  balance_due: number
  payment_status: PaymentStatus
  status: SaleStatus
  note: string | null
  created_by: string | null
  created_at: string
  cancelled_at: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  variant_id: string
  item_snapshot: string
  qty: number
  unit_price_at_sale: number
  discount_amount: number // paise, total for this line — already subtracted out of line_total
  line_total: number
}

export interface Payment {
  id: string
  sale_id: string
  amount: number // paise
  paid_at: string
  note: string | null
}

export interface VariantWithContext {
  id: string
  type_id: string
  size_id: string | null
  size: number | null // resolved from sizes.value — null for a 'freetext'-mode variant
  size_label: string | null // resolved from variants.size_label — set only for 'freetext'-mode
  unit_price: number // paise
  current_stock: number
  active: boolean
  type_name: string
  size_mode: SizeMode // resolved from the type
  product_id: string
  product_name: string
  default_discount: number // paise, per unit — resolved from the type
}

// The size portion of a variant's display text — the custom label for a 'freetext'-mode
// variant, else the formatted numeric size. Callers that need to special-case "no size
// dimension at all" (a 'dropdown'-mode sizeless type) still check `size === 0` themselves.
export function variantSizeText(v: Pick<VariantWithContext, 'size' | 'size_label'>): string {
  return v.size_label ?? formatSize(v.size ?? 0)
}

// Human-readable label for a variant, e.g. "Clamp · Cruiser Clamp / 2"" or, for a
// 'freetext'-mode variant, "Clamp · Rope / Extra thick". Also used as the frozen
// item_snapshot on sale_items. Size 0 (dropdown mode only) means "sizeless" (the type has
// no meaningful size dimension) — omit the size segment entirely rather than showing a
// nonsensical "/ 0"".
export function formatVariantLabel(v: VariantWithContext): string {
  if (v.size_label) return `${v.product_name} · ${v.type_name} / ${v.size_label}`
  return v.size === 0 ? `${v.product_name} · ${v.type_name}` : `${v.product_name} · ${v.type_name} / ${formatSize(v.size ?? 0)}`
}

export interface Settings {
  id: number
  company_name: string
  logo_url: string | null
  currency: string
  currency_prefix: string
  receipt_footer: string | null
  auth_enabled: boolean
  low_stock_threshold: number
}
