export {
  brochureBodyToHtml,
  type CloudflareBrowserBrochurePrinterOptions,
  createBasicPdfProductBrochurePrinter,
  createCloudflareBrowserProductBrochurePrinter,
  createCloudflareBrowserProductBrochurePrinterFromEnv,
  type PrintedProductBrochureArtifact,
  type ProductBrochurePrinter,
  type ProductBrochurePrinterContext,
} from "./brochure-printers.js"
export {
  createDefaultProductBrochureTemplate,
  loadProductBrochureTemplateContext,
  type ProductBrochureDayContext,
  type ProductBrochureTemplateContext,
  type ProductBrochureTemplateDefinition,
  type RenderedProductBrochureTemplate,
  renderProductBrochureTemplate,
} from "./brochure-templates.js"
export {
  type GenerateAndStoreProductBrochureOptions,
  generateAndStoreProductBrochure,
} from "./brochures.js"
export { type GenerateProductPdfResult, generateProductPdf } from "./generate-pdf.js"
