import * as React from "react"

import { cn } from "../lib/utils.js"

export interface SegmentedControlOption {
  label: React.ReactNode
  value: string
  disabled?: boolean
}

export interface SegmentedControlProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  options: ReadonlyArray<SegmentedControlOption>
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/**
 * Segmented control — a compact set of mutually exclusive options where the
 * selected segment reads as a raised card (e.g. dashboard time-range pickers:
 * "Last month / Last 6 months / Last year"). Controlled or uncontrolled.
 */
function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: SegmentedControlProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? options[0]?.value ?? "")
  const current = value ?? internalValue

  const select = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <div
      data-slot="segmented-control"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5 text-sm",
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const active = option.value === current
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={active}
            data-state={active ? "active" : "inactive"}
            onClick={() => select(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-sm px-2.5 py-1 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
