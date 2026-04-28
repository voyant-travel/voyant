import { brochureBodyToHtml, type ProductBrochurePrinter } from "@voyantjs/products/tasks"
import { getVoyantCloudClient, type VoyantCloudEnv } from "./cloud-client.js"

/**
 * Default brochure printer for this template.
 *
 * Renders the product brochure HTML to PDF via Voyant Cloud's browser-rendering
 * API. To switch providers, replace the body of this function — `@voyantjs/products/tasks`
 * exports alternatives like `createCloudflareBrowserProductBrochurePrinter`
 * (direct Cloudflare API) and `createBasicPdfProductBrochurePrinter` (pdf-lib).
 */
export function createProductBrochurePrinter(env: VoyantCloudEnv): ProductBrochurePrinter {
  const client = getVoyantCloudClient(env)

  return async ({ template, context }) => {
    const body = await client.browser.pdf({
      html: brochureBodyToHtml(template.body, template.bodyFormat, template.title),
    })

    return {
      body,
      mimeType: "application/pdf",
      fileSize: body.byteLength,
      metadata: {
        renderer: "voyant-cloud-browser",
        productId: context.product.id,
        bodyFormat: template.bodyFormat,
      },
    }
  }
}
