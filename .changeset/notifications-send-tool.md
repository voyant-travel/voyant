---
"@voyant-travel/notifications": minor
---

Add a **constrained** `send_notification` agent tool. To avoid the arbitrary
email/SMS abuse vector, the tool accepts **only a vetted template** (`templateSlug`
required; raw `subject`/`html`/`text` are rejected at the tool boundary), is gated on
`notifications:send` (never granted by a wildcard), and is marked `destructive` +
`confirmationRequired`. The operator dispatches it through the deployment's real
notification-provider runtime (`createNotificationService(resolveNotificationProviders)`)
— the same path the app uses.
