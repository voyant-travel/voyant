"use client"

import { RemindersPreviewList } from "../components/reminders-preview-list.js"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

/**
 * Packaged admin host for the read-only reminders preview page
 * (packaged-admin RFC Phase 3). Zero-prop: the preview list owns its data
 * wiring through `@voyant-travel/notifications-react`.
 */
export function RemindersPreviewHost() {
  const t = useNotificationsUiMessagesOrDefault().admin.previewPage

  return (
    <div className="mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <RemindersPreviewList />
    </div>
  )
}
