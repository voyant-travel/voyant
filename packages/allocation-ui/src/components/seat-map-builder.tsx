"use client"

import type { SeatLayoutCell, SeatLayoutSpec } from "@voyantjs/availability-react"
import { formatMessage } from "@voyantjs/i18n"
import { Badge, Button, cn } from "@voyantjs/ui/components"
import { DoorOpen, Minus, Plus, RotateCcw, Square, X } from "lucide-react"
import { useMemo } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"

/**
 * Visual editor for a vehicle seat map. Renders a 2D grid the operator can
 * click to cycle each cell through `seat → aisle → door → void`. Used inside
 * the resource-template dialog; the resulting `SeatLayoutSpec` is stored on
 * the template's `flags.layoutSpec` and consumed by the backend materializer.
 *
 * Designed to be controlled — `value` and `onChange` own the spec. Passing
 * `null` clears the spec; the consumer can offer a preset chooser elsewhere
 * if it wants to reset to a starter.
 */
export interface SeatMapBuilderProps {
  value: SeatLayoutSpec | null
  onChange(spec: SeatLayoutSpec | null): void
  /** Hard cap on row count. Defaults to 20, well under the schema's 40. */
  maxRows?: number
  /** Hard cap on cells per row. Defaults to 12, well under the schema's 20. */
  maxColumns?: number
}

const DEFAULT_COLUMNS = 5
const NEXT_KIND: Record<SeatLayoutCell, SeatLayoutCell> = {
  seat: "aisle",
  aisle: "door",
  door: "void",
  void: "seat",
}

export const SEAT_MAP_PRESETS: ReadonlyArray<{
  id: "standardCoach" | "miniCoach" | "largeBus" | "doubleDecker" | "withMidDoor"
  spec: SeatLayoutSpec
}> = [
  { id: "standardCoach", spec: makeUniformSpec(["seat", "seat", "aisle", "seat", "seat"], 11) },
  { id: "miniCoach", spec: makeUniformSpec(["seat", "seat", "aisle", "seat"], 7) },
  { id: "largeBus", spec: makeUniformSpec(["seat", "seat", "seat", "aisle", "seat", "seat"], 11) },
  {
    id: "doubleDecker",
    spec: makeUniformSpec(["seat", "seat", "aisle", "seat", "aisle", "seat", "seat"], 11),
  },
  { id: "withMidDoor", spec: withMidDoor(["seat", "seat", "aisle", "seat", "seat"], 11, 7) },
]

export function SeatMapBuilder({
  value,
  onChange,
  maxRows = 20,
  maxColumns = 12,
}: SeatMapBuilderProps) {
  const messages = useAllocationUiMessagesOrDefault()
  const t = messages.seatMapBuilder

  const spec = value
  const columns = spec?.rows[0]?.cells.length ?? DEFAULT_COLUMNS
  const seatCount = useMemo(() => countSeats(spec), [spec])

  function emitOrClear(next: SeatLayoutSpec) {
    onChange(next.rows.length === 0 ? null : next)
  }

  function cycleCell(rowIndex: number, cellIndex: number) {
    if (!spec) return
    const nextRows = spec.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row
      return {
        cells: row.cells.map((cell, cIdx) => (cIdx === cellIndex ? NEXT_KIND[cell] : cell)),
      }
    })
    emitOrClear({ rows: nextRows })
  }

  function addRow() {
    if (spec && spec.rows.length >= maxRows) return
    const baseCells: SeatLayoutCell[] =
      spec?.rows[spec.rows.length - 1]?.cells.map(() => "seat" as SeatLayoutCell) ??
      new Array<SeatLayoutCell>(DEFAULT_COLUMNS).fill("seat")
    emitOrClear({ rows: [...(spec?.rows ?? []), { cells: baseCells }] })
  }

  function removeRow() {
    if (!spec || spec.rows.length <= 1) {
      onChange(null)
      return
    }
    emitOrClear({ rows: spec.rows.slice(0, -1) })
  }

  function addColumn() {
    if (!spec || columns >= maxColumns) return
    emitOrClear({
      rows: spec.rows.map((row) => ({ cells: [...row.cells, "seat" as SeatLayoutCell] })),
    })
  }

  function removeColumn() {
    if (!spec || columns <= 1) return
    emitOrClear({
      rows: spec.rows.map((row) => ({ cells: row.cells.slice(0, -1) })),
    })
  }

  function applyPreset(preset: SeatLayoutSpec) {
    onChange(preset)
  }

  if (!spec) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-medium text-sm">{t.presetHeading}</p>
          <p className="text-muted-foreground text-xs">{t.presetHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEAT_MAP_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.spec)}
            >
              {t.presets[preset.id]}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{t.heading}</p>
          <p className="text-muted-foreground text-xs">{t.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{formatMessage(t.capacityChip, { count: seatCount })}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
            {t.resetSpec}
          </Button>
        </div>
      </div>

      <CellKindLegend messages={t} />

      <div className="flex flex-col items-start gap-1.5 overflow-x-auto rounded-md border bg-muted/10 p-3">
        {spec.rows.map((row, rowIndex) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional by design — row 1 is always the first row of the bus.
            key={`row-${rowIndex}`}
            className="flex items-center gap-1"
          >
            <span className="w-6 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
              {rowIndex + 1}
            </span>
            {row.cells.map((cell, cellIndex) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional within a row.
                key={`cell-${rowIndex}-${cellIndex}`}
                type="button"
                aria-label={formatMessage(t.columnAria, {
                  row: rowIndex + 1,
                  column: cellIndex + 1,
                })}
                title={t.cellKinds[cell]}
                onClick={() => cycleCell(rowIndex, cellIndex)}
                className={cn(
                  "flex size-9 items-center justify-center rounded border text-[11px] font-medium transition-colors",
                  cellStyles(cell),
                )}
              >
                <CellGlyph cell={cell} short={t.cellKindShort[cell]} />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={spec.rows.length >= maxRows}
        >
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          {t.addRow}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={removeRow}>
          <Minus className="mr-1 size-3.5" aria-hidden="true" />
          {t.removeRow}
        </Button>
        <span className="text-muted-foreground text-xs">
          {formatMessage(t.seatCountSummary, { count: seatCount })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removeColumn}
            disabled={columns <= 1}
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {columns}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addColumn}
            disabled={columns >= maxColumns}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{t.voidDoorReminder}</p>
    </div>
  )
}

function CellKindLegend({
  messages,
}: {
  messages: ReturnType<typeof useAllocationUiMessagesOrDefault>["seatMapBuilder"]
}) {
  const kinds: ReadonlyArray<SeatLayoutCell> = ["seat", "aisle", "door", "void"]
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-xs">{messages.cellKindHeading}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {kinds.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded border text-[10px]",
                cellStyles(kind),
              )}
              aria-hidden="true"
            >
              <CellGlyph cell={kind} short={messages.cellKindShort[kind]} />
            </span>
            {messages.cellKinds[kind]}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-[11px]">{messages.cellKindHint}</p>
    </div>
  )
}

function CellGlyph({ cell, short }: { cell: SeatLayoutCell; short: string }) {
  if (cell === "door") return <DoorOpen className="size-3.5" aria-hidden="true" />
  if (cell === "void") return <X className="size-3 opacity-40" aria-hidden="true" />
  if (cell === "aisle") return <Square className="size-2.5 opacity-30" aria-hidden="true" />
  return <span>{short}</span>
}

function cellStyles(cell: SeatLayoutCell): string {
  switch (cell) {
    case "seat":
      return "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
    case "aisle":
      return "border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground hover:bg-muted/30"
    case "door":
      return "border-amber-500/50 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
    case "void":
      return "border-muted-foreground/20 bg-muted/20 text-muted-foreground/40 hover:bg-muted/40"
  }
}

function countSeats(spec: SeatLayoutSpec | null): number {
  if (!spec) return 0
  let count = 0
  for (const row of spec.rows) {
    for (const cell of row.cells) {
      if (cell === "seat") count += 1
    }
  }
  return count
}

function makeUniformSpec(template: SeatLayoutCell[], rowCount: number): SeatLayoutSpec {
  return { rows: Array.from({ length: rowCount }, () => ({ cells: [...template] })) }
}

function withMidDoor(
  rowTemplate: SeatLayoutCell[],
  rowCount: number,
  doorRowIndex: number,
): SeatLayoutSpec {
  const rows = makeUniformSpec(rowTemplate, rowCount).rows
  const safeIndex = Math.min(Math.max(0, doorRowIndex - 1), rows.length - 1)
  const target = rows[safeIndex]
  if (target) {
    rows[safeIndex] = { cells: target.cells.map(() => "door" as SeatLayoutCell) }
  }
  return { rows }
}
