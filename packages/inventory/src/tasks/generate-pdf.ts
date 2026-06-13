import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

import { productDayServices, productDays, productItineraries, products } from "../schema.js"
import { plainTextForPdf } from "./pdf-text.js"

export type GenerateProductPdfResult = {
  pdfBytes: Uint8Array
  filename: string
  sizeBytes: number
}

export async function generateProductPdf(
  db: PostgresJsDatabase,
  productId: string,
): Promise<GenerateProductPdfResult> {
  // 1. Fetch product
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)

  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }

  const [defaultItinerary] = await db
    .select({ id: productItineraries.id })
    .from(productItineraries)
    .where(and(eq(productItineraries.productId, productId), eq(productItineraries.isDefault, true)))
    .limit(1)

  // 2. Fetch days with services
  const days = defaultItinerary
    ? await db
        .select()
        .from(productDays)
        .where(eq(productDays.itineraryId, defaultItinerary.id))
        .orderBy(asc(productDays.dayNumber))
    : []

  const daysWithServices = await Promise.all(
    days.map(async (day) => {
      const services = await db
        .select()
        .from(productDayServices)
        .where(eq(productDayServices.dayId, day.id))
        .orderBy(asc(productDayServices.sortOrder))
      return { ...day, services }
    }),
  )

  // 3. Generate PDF
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN = 50
  const LINE_HEIGHT = 16

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  function drawText(text: string, options: { font?: typeof font; size?: number; x?: number }) {
    const f = options.font ?? font
    const size = options.size ?? 10
    const x = options.x ?? MARGIN
    ensureSpace(LINE_HEIGHT)
    page.drawText(text, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) })
    y -= LINE_HEIGHT
  }

  // Title
  drawText(product.name, { font: boldFont, size: 20 })
  y -= 8

  // Status & dates
  if (product.startDate || product.endDate) {
    drawText(`Dates: ${product.startDate ?? "TBD"} — ${product.endDate ?? "TBD"}`, { size: 10 })
  }
  if (product.pax) {
    drawText(`Travelers: ${product.pax}`, { size: 10 })
  }
  if (product.sellAmountCents != null) {
    const amount = (product.sellAmountCents / 100).toFixed(2)
    drawText(`Total: ${amount} ${product.sellCurrency}`, { font: boldFont, size: 12 })
  }

  if (product.description) {
    y -= 8
    drawText(plainTextForPdf(product.description), { size: 10 })
  }

  y -= 16

  // Days
  for (const day of daysWithServices) {
    ensureSpace(LINE_HEIGHT * 3)

    // Day header
    const dayTitle = day.title ? `Day ${day.dayNumber}: ${day.title}` : `Day ${day.dayNumber}`
    drawText(dayTitle, { font: boldFont, size: 13 })

    if (day.location) {
      drawText(`Location: ${day.location}`, { size: 9 })
    }
    if (day.description) {
      drawText(plainTextForPdf(day.description), { size: 9 })
    }

    // Services
    for (const svc of day.services) {
      ensureSpace(LINE_HEIGHT * 2)
      const costStr = `${(svc.costAmountCents / 100).toFixed(2)} ${svc.costCurrency}`
      const qty = svc.quantity > 1 ? ` x${svc.quantity}` : ""
      drawText(`  • ${svc.name} (${svc.serviceType})${qty} — ${costStr}`, { size: 9 })
      if (svc.notes) {
        drawText(`    ${svc.notes}`, { size: 8 })
      }
    }

    y -= 8
  }

  // 4. Serialize to bytes
  const pdfBytes = await pdfDoc.save()

  return {
    pdfBytes,
    filename: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    sizeBytes: pdfBytes.length,
  }
}
