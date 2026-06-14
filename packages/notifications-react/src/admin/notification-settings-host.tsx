"use client"

import { NotificationSettingsForm } from "../components/notification-settings-form.js"

/**
 * Packaged admin host for the tenant-wide notification settings page
 * (packaged-admin RFC Phase 3). Zero-prop: the settings form owns its data
 * wiring through `@voyant-travel/notifications-react`.
 */
export function NotificationSettingsHost() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification settings</h1>
        <p className="text-sm text-muted-foreground">
          Tenant-wide quiet hours, blackout dates, recipient rate limits, and suppression window.
        </p>
      </div>
      <NotificationSettingsForm />
    </div>
  )
}
