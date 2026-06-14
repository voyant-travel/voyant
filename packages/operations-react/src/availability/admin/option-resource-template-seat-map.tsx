"use client"

import { formatMessage } from "@voyantjs/i18n"
import { Badge } from "@voyantjs/ui/components"
import { type SeatLayoutSpec, seatLayoutSpecSchema } from "../index.js"

export function SeatMapSummaryBadge({
  flags,
  messages,
}: {
  flags: Record<string, unknown>
  messages: { seatMapSummary: string }
}) {
  const spec = extractLayoutSpec(flags)
  if (!spec) return null
  return (
    <Badge variant="outline" className="text-[10px]">
      {formatMessage(messages.seatMapSummary, {
        rows: spec.rows.length,
        count: countSeats(spec),
      })}
    </Badge>
  )
}

export function extractLayoutSpec(
  flags: Record<string, unknown> | null | undefined,
): SeatLayoutSpec | null {
  const raw = flags?.layoutSpec
  if (!raw) return null
  // Validate against the schema rather than trust the shape — the server
  // stores flags as opaque JSON, so a malformed value (e.g. a row missing
  // `cells`) could otherwise reach `countSeats` and throw at runtime.
  const parsed = seatLayoutSpecSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function countSeats(spec: SeatLayoutSpec | null): number {
  if (!spec) return 0
  let count = 0
  for (const row of spec.rows) {
    for (const cell of row.cells) {
      if (cell === "seat") count += 1
    }
  }
  return count
}
