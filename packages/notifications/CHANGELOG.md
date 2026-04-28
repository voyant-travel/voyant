# @voyantjs/notifications

## 0.14.0

### Minor Changes

- 93fd1a5: Voyant Cloud is now the default email/SMS/verify/vault provider for templates. Resend/Twilio adapters and auto-provider-resolution have been removed from `@voyantjs/notifications`; templates wire `@voyantjs/voyant-cloud` directly.

  **New packages:**

  - `@voyantjs/voyant-cloud` — `getVoyantCloudClient(env)` (throws when `VOYANT_CLOUD_API_KEY` is missing) and `tryGetVoyantCloudClient(env)` (returns `null`). Wraps `@voyantjs/cloud-sdk`.
  - `@voyantjs/verify` — `VerifyProvider` interface (`start` / `check`) plus `createVoyantCloudVerifyProvider({ client })` and `createLocalVerifyProvider()` for dev. `createVerifyService(provider)` is a thin wrapper.
  - `@voyantjs/vault` — `VaultProvider` interface (`getSecret(slug, key)`) plus `createVoyantCloudVaultProvider({ client })` and `createEnvVaultProvider({ env, resolveEnvKey? })` for self-hosters. `createVaultService(provider)` adds `(slug,key)` caching and `requireSecret`.

  **Breaking changes — `@voyantjs/notifications`:**

  - Removed `createResendProvider`, `createTwilioProvider`, `createDefaultNotificationProviders`, `createResendProviderFromEnv`, `createTwilioProviderFromEnv`. Removed sub-paths `./providers/resend`, `./providers/twilio`, `./provider-resolution`. The `local` provider stays for dev.
  - Added `createVoyantCloudEmailProvider({ client, from, replyTo? })` and `createVoyantCloudSmsProvider({ client, from? })` (sub-paths `./providers/voyant-cloud-email`, `./providers/voyant-cloud-sms`).
  - `buildNotificationTaskRuntime(env, options)` now throws when neither `providers` nor `resolveProviders` is supplied — there are no built-in defaults.

  **Breaking change — `@voyantjs/plugin-netopia`:**

  - `buildNetopiaNotificationRuntime` now throws `NetopiaNotificationRuntimeError` when neither `resolveNotificationProviders` nor `notificationProviders` is supplied. Templates must inject providers explicitly.

  **Migration for self-hosters who want raw Resend/Twilio:** implement `NotificationProvider` against your transport of choice and register it in your template's `src/lib/notifications.ts`. The interface is unchanged and remains the public extension point.

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/bookings@0.14.0
  - @voyantjs/core@0.14.0
  - @voyantjs/db@0.14.0
  - @voyantjs/finance@0.14.0
  - @voyantjs/hono@0.14.0
  - @voyantjs/legal@0.14.0
  - @voyantjs/voyant-cloud@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/finance@0.13.0
  - @voyantjs/hono@0.13.0
  - @voyantjs/legal@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/finance@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/legal@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/db@0.11.0
  - @voyantjs/finance@0.11.0
  - @voyantjs/hono@0.11.0
  - @voyantjs/legal@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
- Updated dependencies [29a581a]
  - @voyantjs/bookings@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/legal@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/legal@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/bookings@0.8.0
  - @voyantjs/core@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/finance@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/legal@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/db@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/legal@0.7.0

## 0.6.9

### Patch Changes

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/finance@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/legal@0.6.9

## 0.6.8

### Patch Changes

- b218885: Add composite list indexes for notification admin queries.
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/legal@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/legal@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/legal@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/finance@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/legal@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/legal@0.6.4

## 0.6.3

### Patch Changes

- 93d3734: Make worker-driven due reminder processing durable by queueing reminder runs before provider delivery and delivering each run in its own retryable background task.
- d3c6937: Add a narrow execution lock surface and use it to serialize worker-driven notification reminder sweeps across processes.
- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/legal@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/legal@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/legal@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/legal@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/finance@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/legal@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/legal@0.4.5

## 0.4.4

### Patch Changes

- 9349604: Enrich notification reminder run reads with linked rule, delivery, and entity
  context, and add direct reminder-run lookup for admin workflows.
  - @voyantjs/bookings@0.4.4
  - @voyantjs/core@0.4.4
  - @voyantjs/db@0.4.4
  - @voyantjs/finance@0.4.4
  - @voyantjs/hono@0.4.4
  - @voyantjs/legal@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/finance@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/legal@0.4.3

## 0.4.2

### Patch Changes

- 8de4602: Add optional event-bus hooks around document primitives.

  - `@voyantjs/legal` contract document generation routes/services can now emit
    `contract.document.generated`
  - `@voyantjs/finance` invoice document generation can emit
    `invoice.document.generated`, and settlement reconciliation can emit
    `invoice.settled`
  - `@voyantjs/notifications` booking document sends can emit
    `booking.documents.sent`

  These stay at the primitive layer so apps can orchestrate their own document
  policies without Voyant owning the full workflow.

- Updated dependencies [8de4602]
  - @voyantjs/bookings@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/db@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/legal@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
- Updated dependencies [a49630a]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/finance@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/legal@0.4.1

## 0.4.0

### Minor Changes

- e84fe0f: Add first-class booking document bundle and send workflows. Notifications can
  now list booking-scoped contract/invoice/proforma artifacts, send email
  attachments, and deliver those attachments through Resend using artifact
  download URLs or custom attachment resolvers.
- e84fe0f: Add invoice-targeted reminder rules and runs so unpaid invoice/proforma
  documents created for bank-transfer checkout flows can use the same first-class
  reminder engine and checkout reminder visibility as schedule-backed reminders.

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/legal@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add a first-class public storefront verification flow with email and SMS
  challenge start/confirm routes, pluggable developer-supplied senders, and
  built-in notification-provider adapters including Resend email and Twilio SMS.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/finance@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/bookings@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/finance@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/bookings@0.2.0
- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/finance@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/bookings@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/finance@0.1.1
- @voyantjs/hono@0.1.1
