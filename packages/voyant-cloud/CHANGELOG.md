# @voyantjs/voyant-cloud

## 0.16.0

### Minor Changes

- a4bc773: Templates now default to Voyant Cloud SDK for browser-rendering (PDF brochures) and video uploads. Both are swappable per-template by editing the helper file.

  **`@voyantjs/voyant-cloud`**: bump `@voyantjs/cloud-sdk` peer to `^0.4.0` to access browser/video APIs. Re-export the new types (`BrowserPdfInput`, `BrowserPdfOptions`, `BrowserViewport`, `BrowserGoToOptions`, `BrowserScrapeInput`, `BrowserScreenshotInput`, `BrowserSnapshotResult`, `CreateVideoUploadInput`, `CreateVideoFromUrlInput`, `UpdateVideoInput`, `UploadVideoCaptionInput`, `VideoSummary`, `VideoUploadTicket`, etc.) so consumers only need one import.

  **`@voyantjs/products`**: expose `brochureBodyToHtml` from `tasks/` so consumers can compose their own printer. Previously it was internal to `brochure-printers.ts`.

  **Templates** (`dmc`, `operator`): two new helpers per template, both intentionally cleanly named so the underlying provider is swappable.

  - `src/lib/brochure-printer.ts` — `createProductBrochurePrinter(env)` returns a `ProductBrochurePrinter` that calls `client.browser.pdf({...})`. Replaces the basic pdf-lib path in `workflows.ts → products.generate-pdf`.
  - `src/lib/video-uploads.ts` — `createVideoUploadTicket(env, input)` returns a TUS upload ticket from `client.video.videos.createUpload(...)`. Wired into a new `POST /v1/uploads/video` route. The existing `POST /v1/uploads` keeps handling images/documents through the configured media storage provider (R2 by default).

  To switch providers, edit the helper body — e.g., to use direct Cloudflare API for PDFs, drop in `createCloudflareBrowserProductBrochurePrinterFromEnv`. To use a different video host, return your own TUS ticket shape.

## 0.15.0

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
