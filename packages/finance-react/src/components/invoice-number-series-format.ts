import type { InvoiceNumberSeriesRecord } from "../index.js"

export function formatInvoiceNumberSeriesSample(
  series: Pick<InvoiceNumberSeriesRecord, "currentSequence" | "padLength" | "prefix" | "separator">,
) {
  const nextSequence = series.currentSequence + 1
  return `${series.prefix}${series.separator}${String(nextSequence).padStart(series.padLength, "0")}`
}
