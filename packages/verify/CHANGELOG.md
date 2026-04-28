# @voyantjs/verify

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
  - @voyantjs/voyant-cloud@0.14.0
