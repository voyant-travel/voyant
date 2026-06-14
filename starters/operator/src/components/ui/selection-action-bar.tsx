import type * as React from "react"
import { Button } from "./button"
import { Card, CardContent } from "./card"

function SelectionActionBar({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount: number
  onClear: () => void
  children?: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 py-1 md:flex-row md:items-center md:justify-between">
        <p className="text-sm">
          <span className="font-medium">{selectedCount}</span> selected
        </p>
        <div className="flex items-center gap-2">
          {children}
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { SelectionActionBar }
