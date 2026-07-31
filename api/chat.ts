import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

// Server-side only — never expose SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY to the browser.
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const MODEL = 'gemini-3.6-flash'
const MAX_TOOL_ROUNDS = 4

const SYSTEM_INSTRUCTION = `You are a data assistant for the owner of MIG, a small hardware shop that sells clamps.
Answer questions about the shop's own sales, stock, and customers using ONLY the provided tools — never guess or make up numbers.
Tool results report money in rupees already (not paise) — format it as "Rs. 1,234.00" in your reply.
Keep answers short and conversational, like a quick text reply, not a report. If a tool finds nothing or errors, say so plainly.`

const TOOLS = [
  {
    type: 'function' as const,
    name: 'get_sales_summary',
    description: 'Total revenue, sale count, and payment status breakdown for a date range.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date, inclusive, as YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date, inclusive, as YYYY-MM-DD' }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    type: 'function' as const,
    name: 'get_low_stock_items',
    description: 'Lists variants currently below the shop-wide low-stock threshold, including negative stock from overselling.',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function' as const,
    name: 'get_customer_balance',
    description: 'Looks up a customer by name and returns their outstanding (pending) balance across active sales.',
    parameters: {
      type: 'object',
      properties: { customer_name: { type: 'string', description: 'Customer name to search for (partial match is fine)' } },
      required: ['customer_name']
    }
  },
  {
    type: 'function' as const,
    name: 'get_top_selling_variants',
    description: 'Best-selling product variants by quantity sold over a period.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'], description: 'Time window to rank sales over' }
      },
      required: ['period']
    }
  }
]

function periodStartDate(period: string): Date | null {
  const now = new Date()
  if (period === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (period === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return d
  }
  return null
}

async function getSalesSummary(args: { start_date: string; end_date: string }) {
  const start = new Date(args.start_date)
  const end = new Date(args.end_date)
  end.setDate(end.getDate() + 1)

  const { data, error } = await supabaseAdmin
    .from('sales')
    .select('total, payment_status, balance_due')
    .eq('status', 'active')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) return { error: error.message }

  const rows = data ?? []
  return {
    sale_count: rows.length,
    total_revenue_rupees: rows.reduce((sum, r) => sum + r.total, 0) / 100,
    paid_count: rows.filter((r) => r.payment_status === 'paid').length,
    pending_count: rows.filter((r) => r.payment_status === 'pending').length,
    pending_balance_rupees: rows.filter((r) => r.payment_status === 'pending').reduce((sum, r) => sum + r.balance_due, 0) / 100
  }
}

async function getLowStockItems() {
  const { data, error } = await supabaseAdmin
    .from('low_stock_view')
    .select('product_name, type_name, size, current_stock, unit_price')
    .order('current_stock', { ascending: true })
    .limit(50)

  if (error) return { error: error.message }

  return {
    count: data?.length ?? 0,
    items: (data ?? []).map((v) => ({
      name: `${v.product_name} / ${v.type_name} ${v.size}in`,
      current_stock: v.current_stock,
      unit_price_rupees: v.unit_price / 100
    }))
  }
}

async function getCustomerBalance(args: { customer_name: string }) {
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone')
    .ilike('name', `%${args.customer_name}%`)
    .limit(5)

  if (error) return { error: error.message }
  if (!customers || customers.length === 0) return { found: false, message: `No customer matching "${args.customer_name}".` }
  if (customers.length > 1) {
    return {
      found: false,
      message: 'Multiple customers match that name — ask the owner which one they mean.',
      matches: customers.map((c) => c.name)
    }
  }

  const customer = customers[0]
  const { data: sales, error: salesError } = await supabaseAdmin
    .from('sales')
    .select('balance_due')
    .eq('customer_id', customer.id)
    .eq('status', 'active')
    .eq('payment_status', 'pending')

  if (salesError) return { error: salesError.message }

  return {
    found: true,
    customer_name: customer.name,
    phone: customer.phone,
    pending_sale_count: sales?.length ?? 0,
    pending_balance_rupees: (sales ?? []).reduce((sum, s) => sum + s.balance_due, 0) / 100
  }
}

async function getTopSellingVariants(args: { period: string }) {
  const start = periodStartDate(args.period)

  let query = supabaseAdmin.from('sale_items').select('item_snapshot, qty, sales!inner(status, created_at)').eq('sales.status', 'active')
  if (start) query = query.gte('sales.created_at', start.toISOString())

  const { data, error } = await query
  if (error) return { error: error.message }

  const totals = new Map<string, number>()
  for (const item of data ?? []) {
    totals.set(item.item_snapshot, (totals.get(item.item_snapshot) ?? 0) + item.qty)
  }

  const topVariants = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, qty_sold]) => ({ name, qty_sold }))

  return { period: args.period, top_variants: topVariants }
}

const TOOL_IMPL: Record<string, (args: any) => Promise<unknown>> = {
  get_sales_summary: getSalesSummary,
  get_low_stock_items: getLowStockItems,
  get_customer_balance: getCustomerBalance,
  get_top_selling_variants: getTopSellingVariants
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { message, previous_interaction_id } = (req.body ?? {}) as { message?: string; previous_interaction_id?: string }
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing message' })
    return
  }

  try {
    let interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: TOOLS,
      previous_interaction_id,
      input: message
    })

    let round = 0
    while (round < MAX_TOOL_ROUNDS) {
      const callStep = interaction.steps?.find((s) => s.type === 'function_call') as
        | { type: 'function_call'; id: string; name: string; arguments: Record<string, any> }
        | undefined
      if (!callStep) break

      const impl = TOOL_IMPL[callStep.name]
      const result = impl ? await impl(callStep.arguments) : { error: `Unknown tool ${callStep.name}` }

      interaction = await ai.interactions.create({
        model: MODEL,
        system_instruction: SYSTEM_INSTRUCTION,
        tools: TOOLS,
        previous_interaction_id: interaction.id,
        input: [
          {
            type: 'function_result',
            name: callStep.name,
            call_id: callStep.id,
            result: [{ type: 'text', text: JSON.stringify(result) }]
          }
        ]
      })

      round++
    }

    res.status(200).json({
      reply: interaction.output_text ?? "I couldn't find an answer to that — try rephrasing.",
      interaction_id: interaction.id
    })
  } catch (err) {
    console.error('Chatbot error', err)
    res.status(500).json({ error: 'Something went wrong answering that question.' })
  }
}
