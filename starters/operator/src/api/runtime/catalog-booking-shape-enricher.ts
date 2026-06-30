import type { SourceAdapterContext } from "@voyant-travel/catalog"
import type {
  QuoteEntityResult,
  SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { buildProductDraftShape } from "@voyant-travel/inventory/draft-shape"
import { getProductContent } from "@voyant-travel/inventory/service-content"

interface EnrichProductQuoteShapeInput {
  db: AnyDrizzleDb
  result: QuoteEntityResult
  entityModule: string
  entityId: string
  locale?: string
  market?: string
  currency?: string
  registry: SourceAdapterRegistry
  adapterContext?: SourceAdapterContext
}

export async function enrichProductQuoteShape({
  db,
  result,
  entityModule,
  entityId,
  locale,
  market,
  currency,
  registry,
  adapterContext,
}: EnrichProductQuoteShapeInput): Promise<QuoteEntityResult> {
  if (result.shape || !result.available || entityModule !== "products") return result

  try {
    const resolved = await getProductContent(
      db,
      entityId,
      {
        preferredLocales: uniqueLocales([locale, "en-GB", "en"]),
        market,
        currency,
      },
      {
        registry,
        buildAdapterContext: () =>
          adapterContext ?? {
            connection_id: "products",
          },
      },
    )
    if (!resolved?.content) return result
    return {
      ...result,
      shape: buildProductDraftShape(resolved.content, { locale }),
    }
  } catch (error) {
    console.warn("[catalog-booking] product quote shape enrichment failed:", error)
    return result
  }
}

function uniqueLocales(locales: ReadonlyArray<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const locale of locales) {
    if (!locale || seen.has(locale)) continue
    seen.add(locale)
    out.push(locale)
  }
  return out
}
