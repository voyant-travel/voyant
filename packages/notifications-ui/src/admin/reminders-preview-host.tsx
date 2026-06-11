"use client"

import { RemindersPreviewList } from "../components/reminders-preview-list.js"

/**
 * Packaged admin host for the read-only reminders preview page
 * (packaged-admin RFC Phase 3). Zero-prop: the preview list owns its data
 * wiring through `@voyantjs/notifications-react`.
 */
export function RemindersPreviewHost() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminders preview</h1>
        <p className="text-sm text-muted-foreground">
          What would fire on a chosen date with the active reminder sequences. Read-only.
        </p>
      </div>
      <RemindersPreviewList />
    </div>
  )
}
