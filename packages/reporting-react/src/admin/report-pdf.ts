"use client"

import { toPng } from "html-to-image"
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib"

/**
 * Client-side "visual" PDF: rasterizes each rendered widget card (recharts charts,
 * their HTML legends, tables, KPIs — exactly as shown) and lays them out in a
 * dark-themed PDF that matches the dashboard. Charts stay charts; tables stay
 * tables. Runs in the browser because the charts only exist in the live DOM.
 */

const A4: readonly [number, number] = [595.28, 841.89]
const MARGIN = 40
// Match the admin dark theme so captured cards sit seamlessly on the page.
const PAGE_BG = rgb(0.055, 0.055, 0.062)
const PAGE_BG_HEX = "#0e0e10"
const LIGHT = rgb(0.96, 0.96, 0.97)
const MUTED = rgb(0.6, 0.6, 0.63)

export async function generateReportPdf(report: {
  name: string
  description?: string | null
}): Promise<Blob> {
  const canvas = document.querySelector(".vrb-canvas")
  const widgets = canvas ? Array.from(canvas.querySelectorAll<HTMLElement>(".vrb-widget")) : []

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const newPage = () => {
    const page = doc.addPage([A4[0], A4[1]])
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: PAGE_BG })
    return page
  }
  let page = newPage()
  let y = A4[1] - MARGIN
  const usable = A4[0] - MARGIN * 2

  page.drawText(clip(report.name, bold, 18, usable), {
    x: MARGIN,
    y: y - 14,
    size: 18,
    font: bold,
    color: LIGHT,
  })
  y -= 34
  if (report.description) {
    page.drawText(clip(report.description, font, 10, usable), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: MUTED,
    })
    y -= 22
  }

  for (const widget of widgets) {
    let embedded: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null
    try {
      const dataUrl = await toPng(widget, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: PAGE_BG_HEX,
        // Drop the edit-mode ⚙/✕ controls from the capture.
        filter: (node) =>
          !(node instanceof Element && node.classList?.contains("vrb-widget__actions")),
      })
      embedded = await doc.embedPng(dataUrl)
    } catch {
      embedded = null
    }

    if (!embedded) {
      const title = widget.querySelector(".vrb-widget__title")?.textContent?.trim() ?? "Widget"
      if (y - 30 < MARGIN) {
        page = newPage()
        y = A4[1] - MARGIN
      }
      page.drawText(clip(`${title} — could not be rendered`, font, 10, usable), {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: MUTED,
      })
      y -= 24
      continue
    }

    const scale = Math.min(1, usable / embedded.width)
    const w = embedded.width * scale
    const h = embedded.height * scale
    if (y - h < MARGIN && y < A4[1] - MARGIN - 1) {
      page = newPage()
      y = A4[1] - MARGIN
    }
    page.drawImage(embedded, { x: MARGIN, y: y - h, width: w, height: h })
    y -= h + 16
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}

function clip(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let out = text
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}
