export interface Product {
  id: string
  name: string
  image_url: string | null
  active: boolean
}

export interface ProductType {
  id: string
  product_id: string
  type_name: string
  active: boolean
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
  size_id: string
  unit_price: number // paise
  current_stock: number
  active: boolean
}

export interface LowStockRow {
  variant_id: string
  product_name: string
  type_name: string
  size: number
  current_stock: number
  unit_price: number
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  note: string | null
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
  size_id: string
  size: number // resolved from sizes.value
  unit_price: number // paise
  current_stock: number
  active: boolean
  type_name: string
  product_id: string
  product_name: string
}

// Human-readable label for a variant, e.g. "Clamp · Cruiser Clamp / 2""
// Also used as the frozen item_snapshot on sale_items.
export function formatVariantLabel(v: VariantWithContext): string {
  return `${v.product_name} · ${v.type_name} / ${formatSize(v.size)}`
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