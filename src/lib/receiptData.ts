import { supabase } from './supabase'
import { ReceiptData } from '../components/sale/Receipt'

interface SaleItemRow {
  item_snapshot: string
  qty: number
  unit_price_at_sale: number
  line_total: number
  variants: { product_types: { products: { image_url: string | null } | null } | null } | null
}

// Shared by ReceiptDialog (view/share a receipt) and the one-click download button on
// the All Sales list — both need the exact same sale + items + settings join.
export async function fetchReceiptData(saleId: string): Promise<{ data: ReceiptData | null; error: string | null }> {
  const [{ data: saleRow, error: saleError }, { data: itemRows, error: itemsError }, { data: settingsRow, error: settingsError }] =
    await Promise.all([
      supabase.from('sales').select('*, customers(name)').eq('id', saleId).single(),
      supabase
        .from('sale_items')
        .select('item_snapshot, qty, unit_price_at_sale, line_total, variants(product_types(products(image_url)))')
        .eq('sale_id', saleId),
      supabase.from('settings').select('company_name, receipt_footer').eq('id', 1).single()
    ])

  const error = saleError || itemsError || settingsError
  if (error) return { data: null, error: error.message }

  const data: ReceiptData = {
    companyName: settingsRow?.company_name ?? 'MIG',
    receiptFooter: settingsRow?.receipt_footer ?? null,
    receiptNo: saleRow.receipt_no,
    createdAt: saleRow.created_at,
    customerName: saleRow.customers?.name ?? null,
    total: saleRow.total,
    amountPaid: saleRow.amount_paid,
    balanceDue: saleRow.balance_due,
    paymentStatus: saleRow.payment_status,
    items: ((itemRows ?? []) as unknown as SaleItemRow[]).map((r) => ({
      label: r.item_snapshot,
      imageUrl: r.variants?.product_types?.products?.image_url ?? null,
      qty: r.qty,
      unitPrice: r.unit_price_at_sale,
      lineTotal: r.line_total
    }))
  }

  return { data, error: null }
}
