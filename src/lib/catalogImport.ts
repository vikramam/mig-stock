import { supabase } from './supabase'
import { SizeMode } from '../types'

// Column headers match the "Export catalog" output in Settings, so an exported file
// (edited to add new rows) can be re-imported directly. A row provides EITHER 'Size (in)'
// (for a 'dropdown'-mode type) OR 'Size label' (for a 'freetext'-mode type), never both —
// see importCatalogRows below.
export interface CatalogImportRow {
  Product?: string
  Type?: string
  'Size (in)'?: number
  'Size label'?: string
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
// product_types, and variants that don't exist yet (matched by name/size or name/label),
// and skips variants that already exist rather than overwriting their price. New variants
// with a positive "Opening stock" get an opening add_stock entry, same as a manual
// Add stock — existing variants never touch their stock, since they already have a ledger.
//
// Each row is either a 'dropdown' row (numeric 'Size (in)', matched/created against the
// shared `sizes` master list) or a 'freetext' row ('Size label' text, matched
// case-insensitively against that type's existing labels) — never both. A brand-new type
// takes its size_mode from the first row that creates it; a row for an existing type whose
// size_mode doesn't match the row's own kind is rejected rather than silently mixing modes
// within one type (the app itself locks size_mode once a type has variants, for the same
// reason).
export async function importCatalogRows(rows: CatalogImportRow[]): Promise<CatalogImportSummary> {
  const summary: CatalogImportSummary = { productsCreated: 0, typesCreated: 0, variantsCreated: 0, variantsSkipped: 0, errors: [] }

  const [{ data: products }, { data: types }, { data: variants }, { data: sizes }] = await Promise.all([
    supabase.from('products').select('id, name'),
    supabase.from('product_types').select('id, product_id, type_name, size_mode'),
    supabase.from('variants').select('id, type_id, size_id, size_label'),
    supabase.from('sizes').select('id, value')
  ])

  const productByName = new Map<string, Row>((products ?? []).map((p) => [p.name.toLowerCase(), p as Row]))
  const sizeByValue = new Map<number, Row>((sizes ?? []).map((s) => [s.value, s as Row]))
  const typeByKey = new Map<string, Row>((types ?? []).map((t) => [`${t.product_id}::${t.type_name.toLowerCase()}`, t as Row]))

  // Dropdown variants keyed by "type::s:sizeId", freetext ones by "type::l:lowercased
  // label" — kept in one map since a type is only ever one mode, so the two key shapes
  // never collide for the same type.
  const variantByKey = new Map<string, Row>()
  for (const v of (variants ?? []) as { id: string; type_id: string; size_id: string | null; size_label: string | null }[]) {
    if (v.size_id) variantByKey.set(`${v.type_id}::s:${v.size_id}`, v as unknown as Row)
    else if (v.size_label) variantByKey.set(`${v.type_id}::l:${v.size_label.toLowerCase()}`, v as unknown as Row)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2 // header is row 1 in the spreadsheet
    const productName = row['Product']?.toString().trim()
    const typeName = row['Type']?.toString().trim()
    const price = Number(row['Price (Rs.)'])
    const openingStock = row['Opening stock'] ? Math.floor(Number(row['Opening stock'])) : 0

    const sizeLabel = row['Size label']?.toString().trim() || ''
    const hasLabel = sizeLabel.length > 0
    const sizeValue = Number(row['Size (in)'])
    const hasSize =
      row['Size (in)'] !== undefined && row['Size (in)'] !== null && String(row['Size (in)']).trim() !== '' && Number.isFinite(sizeValue)

    if (!productName || !typeName || !Number.isFinite(price)) {
      summary.errors.push(`Row ${line}: missing or invalid Product/Type/Price (Rs.)`)
      continue
    }
    if (hasLabel && hasSize) {
      summary.errors.push(`Row ${line}: provide either Size (in) or Size label, not both`)
      continue
    }
    if (!hasLabel && !hasSize) {
      summary.errors.push(`Row ${line}: missing or invalid Size (in) / Size label`)
      continue
    }
    const rowMode: SizeMode = hasLabel ? 'freetext' : 'dropdown'

    try {
      let product = productByName.get(productName.toLowerCase())
      if (!product) {
        const { data, error } = await supabase.from('products').insert({ name: productName }).select().single()
        if (error) throw error
        product = data as Row
        productByName.set(productName.toLowerCase(), product)
        summary.productsCreated++
      }

      const typeKey = `${product.id}::${typeName.toLowerCase()}`
      let type = typeByKey.get(typeKey)
      if (!type) {
        const { data, error } = await supabase
          .from('product_types')
          .insert({ product_id: product.id, type_name: typeName, size_mode: rowMode })
          .select()
          .single()
        if (error) throw error
        type = data as Row
        typeByKey.set(typeKey, type)
        summary.typesCreated++
      } else if (type.size_mode !== rowMode) {
        const typeModeLabel = type.size_mode === 'freetext' ? 'custom labels' : 'a size list'
        const rowModeLabel = rowMode === 'freetext' ? 'a Size label' : 'a Size (in)'
        summary.errors.push(`Row ${line}: type "${typeName}" is set to ${typeModeLabel}, but this row provides ${rowModeLabel}`)
        continue
      }

      let variantKey: string
      let sizeId: string | null = null
      let sizeLabelToSave: string | null = null

      if (rowMode === 'dropdown') {
        let sizeRow = sizeByValue.get(sizeValue)
        if (!sizeRow) {
          const { data, error } = await supabase.from('sizes').insert({ value: sizeValue }).select().single()
          if (error) throw error
          sizeRow = data as Row
          sizeByValue.set(sizeValue, sizeRow)
        }
        sizeId = sizeRow.id
        variantKey = `${type.id}::s:${sizeId}`
      } else {
        sizeLabelToSave = sizeLabel
        variantKey = `${type.id}::l:${sizeLabel.toLowerCase()}`
      }

      if (variantByKey.has(variantKey)) {
        summary.variantsSkipped++
        continue
      }

      const { data: variant, error: variantError } = await supabase
        .from('variants')
        .insert({ type_id: type.id, size_id: sizeId, size_label: sizeLabelToSave, unit_price: Math.round(price * 100) })
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
