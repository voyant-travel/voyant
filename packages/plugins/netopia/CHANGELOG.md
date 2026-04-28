# @voyantjs/plugin-netopia

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
  - @voyantjs/checkout@0.14.0
  - @voyantjs/core@0.14.0
  - @voyantjs/finance@0.14.0
  - @voyantjs/hono@0.14.0
  - @voyantjs/notifications@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/checkout@0.13.0
- @voyantjs/core@0.13.0
- @voyantjs/finance@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/notifications@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/checkout@0.12.0
- @voyantjs/core@0.12.0
- @voyantjs/finance@0.12.0
- @voyantjs/hono@0.12.0
- @voyantjs/notifications@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/checkout@0.11.0
- @voyantjs/core@0.11.0
- @voyantjs/finance@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/notifications@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/checkout@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/notifications@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/checkout@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/notifications@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/checkout@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/finance@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/notifications@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/checkout@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/notifications@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/checkout@0.6.9
- @voyantjs/core@0.6.9
- @voyantjs/finance@0.6.9
- @voyantjs/hono@0.6.9
- @voyantjs/notifications@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/checkout@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/notifications@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/checkout@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/notifications@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/checkout@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/notifications@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/checkout@0.6.5
- @voyantjs/core@0.6.5
- @voyantjs/finance@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/notifications@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/checkout@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/notifications@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [93d3734]
- Updated dependencies [d3c6937]
  - @voyantjs/checkout@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/notifications@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/checkout@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/notifications@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/checkout@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/notifications@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/checkout@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/notifications@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/checkout@0.5.0
- @voyantjs/core@0.5.0
- @voyantjs/finance@0.5.0
- @voyantjs/hono@0.5.0
- @voyantjs/notifications@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/checkout@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/notifications@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [9349604]
  - @voyantjs/checkout@0.4.4
  - @voyantjs/core@0.4.4
  - @voyantjs/finance@0.4.4
  - @voyantjs/hono@0.4.4
  - @voyantjs/notifications@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [02119e0]
  - @voyantjs/checkout@0.4.3
  - @voyantjs/core@0.4.3
  - @voyantjs/finance@0.4.3
  - @voyantjs/hono@0.4.3
  - @voyantjs/notifications@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/checkout@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/notifications@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [a49630a]
  - @voyantjs/checkout@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/finance@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/notifications@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add a fuller storefront payment bootstrap surface to checkout.

  - allow exact-amount collection overrides in checkout plans and initiation
  - return customer-safe bank transfer instructions from checkout when configured
  - support combined provider startup in checkout through injected payment
    starters
  - add a Netopia checkout starter helper in `@voyantjs/plugin-netopia`

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/checkout@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/notifications@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/core@0.3.1
  - @voyantjs/finance@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/notifications@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/finance@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/notifications@0.3.0

## 0.2.0

### Patch Changes

- 99c6dac: Fix the published package layout so plugin build output lands at `dist/*` without leaking `dist/src/*` or compiled tests into npm tarballs.
  - @voyantjs/core@0.2.0
  - @voyantjs/finance@0.2.0
  - @voyantjs/hono@0.2.0
  - @voyantjs/notifications@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/finance@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/notifications@0.1.1
