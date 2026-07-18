import type { DocumentRenderer, PdfRenderRequest } from "@voyant-travel/core/document-rendering"
import { hardenRenderedHtmlDocument } from "@voyant-travel/utils/template-renderer"

import type {
  ContractDocumentGeneratorContext,
  StorageBackedContractDocumentSerializer,
  StorageBackedContractDocumentUpload,
} from "./service-documents.js"

export type DocumentPdfOptions = NonNullable<PdfRenderRequest["page"]>
export type DocumentNavigationOptions = NonNullable<PdfRenderRequest["navigation"]>

/** @deprecated Implement DocumentRenderer instead. */
export interface CloudBrowserRenderClient {
  browser: {
    pdf(input: CloudBrowserPdfInput): Promise<Uint8Array>
  }
}

/** @deprecated Use PdfRenderRequest navigation options. */
export type CloudBrowserWaitUntil = NonNullable<DocumentNavigationOptions["waitUntil"]>

/** @deprecated Use DocumentNavigationOptions. */
export interface CloudBrowserGoToOptions {
  waitUntil?: CloudBrowserWaitUntil
  timeout?: number
  referer?: string
}

/** @deprecated Use DocumentPdfOptions. */
export type CloudBrowserPdfOptions = DocumentPdfOptions

/** @deprecated Use PdfRenderRequest. */
export interface CloudBrowserPdfInput {
  url?: string
  html?: string
  pdfOptions?: CloudBrowserPdfOptions
  goToOptions?: CloudBrowserGoToOptions
  emulateMediaType?: "screen" | "print"
  waitForTimeout?: number
  [key: string]: unknown
}

export interface CreateRenderedPdfContractDocumentSerializerOptions {
  renderer: DocumentRenderer
  htmlWrapper?: (context: ContractDocumentGeneratorContext) => string | Promise<string>
  pdfOptions?: DocumentPdfOptions
  navigation?: DocumentNavigationOptions
  filename?: (context: ContractDocumentGeneratorContext) => string | Promise<string>
}

export function defaultContractHtmlWrapper(context: ContractDocumentGeneratorContext): string {
  const body = context.renderedBody ?? ""
  const trimmed = body.trim()
  if (/^<!doctype\b/i.test(trimmed) || /^<html\b/i.test(trimmed)) return body

  const lang = escapeHtmlAttr(context.contract.language ?? "en")
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>Contract ${escapeHtml(context.contract.id)}</title>
  <style>
    @page { margin: 1.5cm 1.5cm 1.8cm 1.5cm; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
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

const DEFAULT_PDF_OPTIONS: DocumentPdfOptions = {
  format: "a4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="font-size:9px;width:100%;text-align:center;color:#9ca3af;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "1.5cm", bottom: "1.8cm", left: "1.5cm", right: "1.5cm" },
}

const DEFAULT_NAVIGATION: DocumentNavigationOptions = {
  waitUntil: "networkidle0",
  timeoutMs: 30_000,
}

/** Adapt the shared deployment renderer to Legal's storage-backed contract pipeline. */
export function createRenderedPdfContractDocumentSerializer(
  options: CreateRenderedPdfContractDocumentSerializerOptions,
): StorageBackedContractDocumentSerializer {
  const wrapHtml = options.htmlWrapper ?? defaultContractHtmlWrapper
  const page = { ...DEFAULT_PDF_OPTIONS, ...(options.pdfOptions ?? {}) }
  const navigation = { ...DEFAULT_NAVIGATION, ...(options.navigation ?? {}) }
  const filename =
    options.filename ??
    ((context: ContractDocumentGeneratorContext) => `contract-${context.contract.id}.pdf`)

  return async (context): Promise<StorageBackedContractDocumentUpload> => {
    const body = await options.renderer.renderPdf({
      html: hardenRenderedHtmlDocument(await wrapHtml(context)),
      page,
      navigation,
      mediaType: "print",
    })

    return {
      body,
      name: await filename(context),
      mimeType: "application/pdf",
      metadata: {
        renderedBodyFormat: context.renderedBodyFormat,
        renderer: options.renderer.name,
      },
    }
  }
}

/** @deprecated Use CreateRenderedPdfContractDocumentSerializerOptions. */
export interface CreateBrowserRenderedPdfContractDocumentSerializerOptions {
  cloudClient: CloudBrowserRenderClient
  htmlWrapper?: CreateRenderedPdfContractDocumentSerializerOptions["htmlWrapper"]
  pdfOptions?: CloudBrowserPdfOptions
  goToOptions?: CloudBrowserGoToOptions
  filename?: CreateRenderedPdfContractDocumentSerializerOptions["filename"]
}

/** @deprecated Bind a DocumentRenderer and use createRenderedPdfContractDocumentSerializer. */
export function createBrowserRenderedPdfContractDocumentSerializer(
  options: CreateBrowserRenderedPdfContractDocumentSerializerOptions,
): StorageBackedContractDocumentSerializer {
  return createRenderedPdfContractDocumentSerializer({
    renderer: {
      name: "voyant-cloud-browser-rendering",
      renderPdf: (request) =>
        options.cloudClient.browser.pdf({
          html: request.html,
          pdfOptions: request.page,
          gotoOptions: request.navigation
            ? {
                waitUntil: request.navigation.waitUntil,
                timeout: request.navigation.timeoutMs,
                referer: request.navigation.referer,
              }
            : undefined,
          emulateMediaType: request.mediaType,
          waitForTimeout: request.waitForTimeoutMs,
        }),
    },
    htmlWrapper: options.htmlWrapper,
    pdfOptions: options.pdfOptions,
    navigation: options.goToOptions
      ? {
          waitUntil: options.goToOptions.waitUntil,
          timeoutMs: options.goToOptions.timeout,
          referer: options.goToOptions.referer,
        }
      : undefined,
    filename: options.filename,
  })
}
