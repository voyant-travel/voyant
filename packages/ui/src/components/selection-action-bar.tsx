import type * as React from "react"
import { Button } from "./button"
import { Card, CardContent } from "./card"

function SelectionActionBar({
  selectedCount,
  onClear,
  selectionSummary,
  clearLabel = "Clear Selection",
  children,
}: {
  selectedCount: number
  onClear: () => void
  selectionSummary?: React.ReactNode
  clearLabel?: string
  children?: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 py-1 md:flex-row md:items-center md:justify-between">
        <p className="text-sm">
          {selectionSummary ?? (
            <span>
              <span className="font-medium">{selectedCount}</span> selected
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {children}
          <Button variant="outline" size="sm" onClick={onClear}>
            {clearLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { SelectionActionBar }
