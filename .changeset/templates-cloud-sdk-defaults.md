---
"@voyantjs/voyant-cloud": minor
"@voyantjs/products": patch
---

Templates now default to Voyant Cloud SDK for browser-rendering (PDF brochures) and video uploads. Both are swappable per-template by editing the helper file.

**`@voyantjs/voyant-cloud`**: bump `@voyantjs/cloud-sdk` peer to `^0.4.0` to access browser/video APIs. Re-export the new types (`BrowserPdfInput`, `BrowserPdfOptions`, `BrowserViewport`, `BrowserGoToOptions`, `BrowserScrapeInput`, `BrowserScreenshotInput`, `BrowserSnapshotResult`, `CreateVideoUploadInput`, `CreateVideoFromUrlInput`, `UpdateVideoInput`, `UploadVideoCaptionInput`, `VideoSummary`, `VideoUploadTicket`, etc.) so consumers only need one import.

**`@voyantjs/products`**: expose `brochureBodyToHtml` from `tasks/` so consumers can compose their own printer. Previously it was internal to `brochure-printers.ts`.

**Templates** (`dmc`, `operator`): two new helpers per template, both intentionally cleanly named so the underlying provider is swappable.

- `src/lib/brochure-printer.ts` — `createProductBrochurePrinter(env)` returns a `ProductBrochurePrinter` that calls `client.browser.pdf({...})`. Replaces the basic pdf-lib path in `workflows.ts → products.generate-pdf`.
- `src/lib/video-uploads.ts` — `createVideoUploadTicket(env, input)` returns a TUS upload ticket from `client.video.videos.createUpload(...)`. Wired into a new `POST /v1/uploads/video` route. The existing `POST /v1/uploads` keeps handling images/documents through the configured media storage provider (R2 by default).

To switch providers, edit the helper body — e.g., to use direct Cloudflare API for PDFs, drop in `createCloudflareBrowserProductBrochurePrinterFromEnv`. To use a different video host, return your own TUS ticket shape.
