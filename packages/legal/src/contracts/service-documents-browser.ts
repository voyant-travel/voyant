/**
 * Browser-rendered contract PDF serializer — feeds the Liquid-rendered
 * HTML body into Cloudflare Browser Rendering (via the Voyant Cloud
 * SDK) and stores the resulting PDF bytes through the same
 * StorageProvider pipeline used by the basic pdf-lib serializer.
 *
 * Why this exists:
 *   - `defaultPdfContractDocumentSerializer` renders text-only PDFs
 *     via `pdf-lib` — fine for prototypes but unbranded, no CSS,
 *     no headers/footers. Production contracts need a stylable
 *     output, which Browser Rendering gives us "for free" once the
 *     Liquid body is wrapped in a complete HTML document.
 *   - Operators register this serializer via
 *     `createBrowserRenderedPdfContractDocumentSerializer({
 *        cloudClient, htmlWrapper?, pdfOptions?
 *      })` and pass it to `createStorageBackedContractDocumentGenerator`.
 *
 * The Cloud SDK isn't a hard dep of `@voyant-travel/legal`: we type only
 * the shape we need (`{ browser: { pdf: ({ html, pdfOptions }) =>
 * Promise<Uint8Array> } }`), so the legal package stays decoupled
 * from any specific HTTP transport. Operators wire their cloud
 * client at template level.
 */

import { hardenRenderedHtmlDocument } from "@voyant-travel/utils/template-renderer"

import type {
  ContractDocumentGeneratorContext,
  StorageBackedContractDocumentSerializer,
  StorageBackedContractDocumentUpload,
} from "./service-documents.js"

/**
 * Subset of `@voyant-travel/cloud-sdk`'s client surface we depend on. Kept
 * structural so the legal package doesn't pull in the SDK transitively.
 */
export interface CloudBrowserRenderClient {
  browser: {
    pdf: (input: CloudBrowserPdfInput) => Promise<Uint8Array>
  }
}

export type CloudBrowserWaitUntil = "load" | "domcontentloaded" | "networkidle0" | "networkidle2"

export interface CloudBrowserGoToOptions {
  waitUntil?: CloudBrowserWaitUntil
  timeout?: number
  referer?: string
}

export interface CloudBrowserPdfInput {
  url?: string
  html?: string
  pdfOptions?: CloudBrowserPdfOptions
  goToOptions?: CloudBrowserGoToOptions
  emulateMediaType?: "screen" | "print"
  waitForTimeout?: number
  [key: string]: unknown
}

export interface CloudBrowserPdfOptions {
  format?:
    | "letter"
    | "legal"
    | "tabloid"
    | "ledger"
    | "a0"
    | "a1"
    | "a2"
    | "a3"
    | "a4"
    | "a5"
    | "a6"
  landscape?: boolean
  printBackground?: boolean
  scale?: number
  margin?: {
    top?: number | string
    bottom?: number | string
    left?: number | string
    right?: number | string
  }
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

/**
 * Wrap the raw rendered template body in a complete HTML document
 * with print-friendly defaults. Operators that already render full
 * HTML (with `<html>`, `<head>`, custom CSS) should detect that and
 * pass the body through untouched — supply a custom `htmlWrapper`.
 *
 * The default wrapper:
 *   - Sets a print-friendly base font + line-height
 *   - Honours `@page` margins (the print server applies them)
 *   - Adds modest spacing between block elements so plain Liquid
 *     output reads as a document, not a wall of text.
 */
export function defaultContractHtmlWrapper(context: ContractDocumentGeneratorContext): string {
  const body = context.renderedBody ?? ""
  const lang = context.contract.language ?? "en"
  // If the rendered body already looks like a full document
  // (`<!DOCTYPE` or `<html`), return it as-is — the operator's
  // template controls all styling.
  const trimmed = body.trim()
  if (/^<!doctype\b/i.test(trimmed) || /^<html\b/i.test(trimmed)) {
    return body
  }
  // Otherwise wrap in a print-stylesheet shell. The styles are
  // intentionally conservative — operators that want richer output
  // pass their own `htmlWrapper`.
  return `<!doctype html>
<html lang="${escapeHtmlAttr(lang)}">
<head>
  <meta charset="utf-8" />
  <title>Contract ${escapeHtml(context.contract.id)}</title>
  <style>
    @page { margin: 1.5cm 1.5cm 1.8cm 1.5cm; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #111;
    }
    h1, h2, h3, h4 { page-break-after: avoid; }
    p, li { orphans: 2; widows: 2; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    img { max-width: 100%; height: auto; }
    hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>${body}</body>
</html>`
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeHtmlAttr(input: string): string {
  return escapeHtml(input).replace(/"/g, "&quot;")
}

export interface CreateBrowserRenderedPdfContractDocumentSerializerOptions {
  /**
   * Cloud client used to invoke `/browser/v1/pdf`. Operators pass an
   * instantiated `@voyant-travel/cloud-sdk` client; the legal package
   * doesn't import the SDK directly to keep the dep optional.
   */
  cloudClient: CloudBrowserRenderClient
  /**
   * Optional override for the HTML document wrapper. Receives the
   * generator context and must return a complete HTML string. The
   * default wrapper is sufficient for plain Liquid bodies; supply
   * one when the contract template body already includes `<html>`
   * or you need branded headers/footers.
   */
  htmlWrapper?: (context: ContractDocumentGeneratorContext) => string | Promise<string>
  /**
   * Default `pdfOptions` forwarded to Browser Rendering. Operators
   * usually want `{ format: "a4", printBackground: true,
   * displayHeaderFooter: true, headerTemplate: "<span></span>",
   * footerTemplate: '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
   * margin: { top: "1.5cm", bottom: "1.8cm", left: "1.5cm", right: "1.5cm" } }`.
   */
  pdfOptions?: CloudBrowserPdfOptions
  /**
   * Forwarded to the Cloud SDK's `goToOptions`. Defaults to
   * `{ waitUntil: "networkidle0", timeout: 30000 }` — sufficient for
   * static HTML, longer for templates that pull external assets.
   */
  goToOptions?: CloudBrowserGoToOptions
  /**
   * Override the generated filename. Defaults to
   * `contract-${contractId}.pdf`. Operators wanting Romanian-style
   * filenames (`CONTRACT 1234 - Ion Popescu din 04.05.2026.pdf`)
   * supply a custom function.
   */
  filename?: (context: ContractDocumentGeneratorContext) => string | Promise<string>
}

const DEFAULT_PDF_OPTIONS: CloudBrowserPdfOptions = {
  format: "a4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="font-size:9px;width:100%;text-align:center;color:#9ca3af;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "1.5cm", bottom: "1.8cm", left: "1.5cm", right: "1.5cm" },
}

const DEFAULT_GOTO: CloudBrowserGoToOptions = {
  waitUntil: "networkidle0",
  timeout: 30000,
}

/**
 * Build a `StorageBackedContractDocumentSerializer` that renders the
 * contract body to a PDF via Cloudflare Browser Rendering.
 *
 * Use it like:
 *
 *   const generator = createStorageBackedContractDocumentGenerator({
 *     storage,
 *     serializer: createBrowserRenderedPdfContractDocumentSerializer({
 *       cloudClient: voyantCloudClient,
 *     }),
 *   })
 *
 * The returned serializer throws when Browser Rendering returns a
 * non-2xx response — the surrounding workflow / subscriber catches
 * and records that as a failed step, which the dashboard surfaces.
 */
export function createBrowserRenderedPdfContractDocumentSerializer(
  options: CreateBrowserRenderedPdfContractDocumentSerializerOptions,
): StorageBackedContractDocumentSerializer {
  const wrapHtml = options.htmlWrapper ?? defaultContractHtmlWrapper
  const pdfOptions = { ...DEFAULT_PDF_OPTIONS, ...(options.pdfOptions ?? {}) }
  const goToOptions = { ...DEFAULT_GOTO, ...(options.goToOptions ?? {}) }
  const filenameFn =
    options.filename ??
    ((ctx: ContractDocumentGeneratorContext) => `contract-${ctx.contract.id}.pdf`)

  return async (context): Promise<StorageBackedContractDocumentUpload> => {
    const html = hardenRenderedHtmlDocument(await wrapHtml(context))
    const pdfBytes = await options.cloudClient.browser.pdf({
      html,
      pdfOptions,
      // CF Browser Rendering's `/pdf` endpoint expects `gotoOptions`
      // (lowercase). The cloud-sdk's TypeScript type currently
      // declares it as `goToOptions` (camelCase) which CF rejects
      // with `unrecognized_keys`. Send the lowercase version directly
      // via the input's `[key: string]: unknown` index signature
      // until the SDK type is fixed upstream.
      gotoOptions: goToOptions,
      // Force the print stylesheet so `@page` rules apply consistently;
      // the screen variant is what users see in the in-app preview,
      // not what gets archived as the signed contract.
      emulateMediaType: "print",
    })
    const filename = await filenameFn(context)

    return {
      body: pdfBytes,
      name: filename,
      mimeType: "application/pdf",
      metadata: {
        renderedBodyFormat: context.renderedBodyFormat,
        renderer: "voyant-cloud-browser-rendering",
      },
    }
  }
}
