import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  createHttpDocumentRendererFromEnv,
  type DocumentRenderer,
} from "@voyant-travel/core/document-rendering"

import type { InventoryBrochureRuntime } from "./runtime-ports.js"
import {
  brochureBodyToHtml,
  type ProductBrochurePrinter,
  type ProductBrochurePrinterContext,
} from "./tasks/brochure-printers.js"

type BrochureRuntimePrimitives = Pick<VoyantRuntimeHostPrimitives, "env">
type ConfiguredRenderer = DocumentRenderer | Promise<DocumentRenderer>

/** Adapt the shared deployment renderer to Inventory's brochure artifact contract. */
export function createProductBrochurePrinter(
  configuredRenderer: ConfiguredRenderer,
): ProductBrochurePrinter {
  return async ({ template, context }: ProductBrochurePrinterContext) => {
    const renderer = await configuredRenderer
    const body = await renderer.renderPdf({
      html: brochureBodyToHtml(template.body, template.bodyFormat, template.title),
      page: { format: "a4", printBackground: true },
      navigation: { waitUntil: "networkidle0", timeoutMs: 30_000 },
      mediaType: "print",
    })
    return {
      body,
      mimeType: "application/pdf",
      fileSize: body.byteLength,
      metadata: {
        renderer: renderer.name,
        productId: context.product.id,
        bodyFormat: template.bodyFormat,
      },
    }
  }
}

/** Build Inventory's brochure printer policy from generic graph host primitives. */
export function createInventoryBrochureRuntime(
  primitives: BrochureRuntimePrimitives,
  configuredRenderer?: ConfiguredRenderer | null,
): InventoryBrochureRuntime {
  return {
    resolvePrinter: (context) => {
      const renderer =
        configuredRenderer ?? createHttpDocumentRendererFromEnv(primitives.env(context.env))
      return renderer ? createProductBrochurePrinter(renderer) : null
    },
  }
}
