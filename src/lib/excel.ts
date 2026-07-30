import type * as XLSXType from 'xlsx'

// xlsx (SheetJS) is only needed for import/export actions on the Settings page —
// dynamically imported so it doesn't bloat the app's initial load (and PWA precache)
// for every visit.
async function loadXlsx(): Promise<typeof XLSXType> {
  return import('xlsx')
}

export async function readWorkbookFile(file: File): Promise<XLSXType.WorkBook> {
  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

export async function sheetToRows<T = Record<string, unknown>>(wb: XLSXType.WorkBook, sheetName?: string): Promise<T[]> {
  const XLSX = await loadXlsx()
  const name = sheetName ?? wb.SheetNames[0]
  const sheet = wb.Sheets[name]
  return sheet ? XLSX.utils.sheet_to_json<T>(sheet) : []
}

export async function downloadRowsAsSheet(rows: Record<string, unknown>[], sheetName: string, filename: string): Promise<void> {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  XLSX.writeFile(wb, filename)
}

export async function downloadWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string): Promise<void> {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    // Sheet names are capped at 31 chars and can't contain []:*?/\
    const safeName = name.slice(0, 31).replace(/[[\]:*?/\\]/g, '_')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), safeName)
  })
  XLSX.writeFile(wb, filename)
}
