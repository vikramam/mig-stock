import { createClient } from '@supabase/supabase-js'
import { VariantWithContext } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Formats an integer amount stored in paise into "Rs. 1,234.00"
export function formatMoney(paise: number): string {
  const rupees = paise / 100
  return `Rs. ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Parses a rupees string (e.g. "42.50") entered by a user into an integer paise amount.
export function parseRupeesToPaise(input: string): number {
  const rupees = parseFloat(input)
  return Number.isFinite(rupees) ? Math.round(rupees * 100) : 0
}

interface VariantContextRow {
  id: string
  type_id: string
  size_id: string
  unit_price: number
  current_stock: number
  active: boolean
  sizes: { value: number } | null
  product_types: {
    type_name: string
    width_id: string
    product_id: string
    widths: { value: number } | null
    products: { name: string } | null
  } | null
}

// Fetches active variants flattened with their product/type/width/size context — used
// anywhere a cashier needs to search variants by product/type/size (Add stock, New sale).
export async function fetchActiveVariants(): Promise<{ data: VariantWithContext[]; error: string | null }> {
  const { data, error } = await supabase
    .from('variants')
    .select(
      'id, type_id, size_id, unit_price, current_stock, active, sizes(value), product_types(type_name, width_id, product_id, widths(value), products(name))'
    )
    .eq('active', true)

  if (error) return { data: [], error: error.message }

  const flattened: VariantWithContext[] = ((data ?? []) as unknown as VariantContextRow[])
    .filter((v) => v.product_types)
    .map((v) => ({
      id: v.id,
      type_id: v.type_id,
      size_id: v.size_id,
      size: v.sizes?.value ?? 0,
      unit_price: v.unit_price,
      current_stock: v.current_stock,
      active: v.active,
      type_name: v.product_types!.type_name,
      width_id: v.product_types!.width_id,
      width: v.product_types!.widths?.value ?? 0,
      product_id: v.product_types!.product_id,
      product_name: v.product_types!.products?.name ?? 'Unknown product'
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name) || a.type_name.localeCompare(b.type_name))

  return { data: flattened, error: null }
}

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

// Uploads a product photo to the public `product-images` Storage bucket and returns its
// public URL. Public because receipts are shared outside the app (WhatsApp etc.) and need
// to load the image without a Supabase session — see supabase/schema.sql section 9.
export async function uploadProductImage(file: File): Promise<{ url: string | null; error: string | null }> {
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return { url: null, error: 'Image is too large (max 5 MB).' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, { cacheControl: '3600' })
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
