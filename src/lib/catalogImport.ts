import { supabase } from './supabase'

// Column headers match the "Export catalog" output in Settings, so an exported file
// (edited to add new rows) can be re-imported directly.
export interface CatalogImportRow {
  Product?: string
  Type?: string
  'Size (in)'?: number
  'Price (Rs.)'?: number
  'Opening stock'?: number
}

export interface CatalogImportSummary {
  productsCreated: number
  typesCreated: number
  variantsCreated: number
  variantsSkipped: number
  errors: string[]
}

interface Row {
  id: string
  [key: string]: unknown
}

// Reconciles an uploaded catalog sheet against the live catalog: creates products,
// product_types, and variants that don't exist yet (matched by name/size), and
// skips variants that already exist rather than overwriting their price. New variants
// with a positive "Opening stock" get an opening add_stock entry, same as a manual
// Add stock — existing variants never touch their stock, since they already have a ledger.
export async function importCatalogRows(rows: CatalogImportRow[]): Promise<CatalogImportSummary> {
  const summary: CatalogImportSummary = { productsCreated: 0, typesCreated: 0, variantsCreated: 0, variantsSkipped: 0, errors: [] }

  const [{ data: products }, { data: types }, { data: variants }, { data: sizes }] = await Promise.all([
    supabase.from('products').select('id, name'),
    supabase.from('product_types').select('id, product_id, type_name'),
    supabase.from('variants').select('id, type_id, size_id'),
    supabase.from('sizes').select('id, value')
  ])

  const productByName = new Map<string, Row>((products ?? []).map((p) => [p.name.toLowerCase(), p as Row]))
  const sizeByValue = new Map<number, Row>((sizes ?? []).map((s) => [s.value, s as Row]))
  const typeByKey = new Map<string, Row>((types ?? []).map((t) => [`${t.product_id}::${t.type_name.toLowerCase()}`, t as Row]))
  const variantByKey = new Map<string, Row>((variants ?? []).map((v) => [`${v.type_id}::${v.size_id}`, v as Row]))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2 // header is row 1 in the spreadsheet
    const productName = row['Product']?.toString().trim()
    const typeName = row['Type']?.toString().trim()
    const size = Number(row['Size (in)'])
    const price = Number(row['Price (Rs.)'])
    const openingStock = row['Opening stock'] ? Math.floor(Number(row['Opening stock'])) : 0

    if (!productName || !typeName || !Number.isFinite(size) || !Number.isFinite(price)) {
      summary.errors.push(`Row ${line}: missing or invalid Product/Type/Size (in)/Price (Rs.)`)
      continue
    }

    try {
      let product = productByName.get(productName.toLowerCase())
      if (!product) {
        const { data, error } = await supabase.from('products').insert({ name: productName }).select().single()
        if (error) throw error
        product = data as Row
        productByName.set(productName.toLowerCase(), product)
        summary.productsCreated++
      }

      let sizeRow = sizeByValue.get(size)
      if (!sizeRow) {
        const { data, error } = await supabase.from('sizes').insert({ value: size }).select().single()
        if (error) throw error
        sizeRow = data as Row
        sizeByValue.set(size, sizeRow)
      }

      const typeKey = `${product.id}::${typeName.toLowerCase()}`
      let type = typeByKey.get(typeKey)
      if (!type) {
        const { data, error } = await supabase
          .from('product_types')
          .insert({ product_id: product.id, type_name: typeName })
          .select()
          .single()
        if (error) throw error
        type = data as Row
        typeByKey.set(typeKey, type)
        summary.typesCreated++
      }

      const variantKey = `${type.id}::${sizeRow.id}`
      if (variantByKey.has(variantKey)) {
        summary.variantsSkipped++
        continue
      }

      const { data: variant, error: variantError } = await supabase
        .from('variants')
        .insert({ type_id: type.id, size_id: sizeRow.id, unit_price: Math.round(price * 100) })
        .select()
        .single()
      if (variantError) throw variantError
      variantByKey.set(variantKey, variant as Row)
      summary.variantsCreated++

      if (openingStock > 0) {
        const { error: stockError } = await supabase.rpc('add_stock', {
          p_variant_id: variant.id,
          p_qty: openingStock,
          p_note: 'Opening stock (Excel import)',
          p_created_by: null
        })
        if (stockError) summary.errors.push(`Row ${line}: variant created but opening stock failed — ${stockError.message}`)
      }
    } catch (err) {
      summary.errors.push(`Row ${line}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return summary
}
