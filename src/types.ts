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
  width: string
  active: boolean
}

export interface Variant {
  id: string
  type_id: string
  size: string
  unit_price: number // paise
  current_stock: number
  active: boolean
}

export interface LowStockRow {
  variant_id: string
  product_name: string
  type_name: string
  width: string
  size: string
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
  created_at: string
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
