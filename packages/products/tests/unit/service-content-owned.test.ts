import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"
import {
  productDayServices,
  productDayServiceTranslations,
  productDays,
  productDayTranslations,
  productItineraries,
  productMedia,
  productOptions,
  productOptionTranslations,
  products,
  productTranslations,
} from "../../src/schema.js"
import { buildOwnedProductContent } from "../../src/service-content-owned.js"

class FakeSelectQuery {
  private table: unknown

  constructor(private readonly rowsByTable: Map<unknown, unknown[]>) {}

  from(table: unknown) {
    this.table = table
    return this
  }

  where() {
    return this
  }

  orderBy() {
    return this
  }

  limit() {
    return this
  }

  // biome-ignore lint/suspicious/noThenProperty: Drizzle select queries are awaitable; the fake mirrors that surface.
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.rowsByTable.get(this.table) ?? []).then(onfulfilled, onrejected)
  }
}

function createDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => new FakeSelectQuery(rowsByTable),
    execute: async () => [],
  }
}

describe("buildOwnedProductContent", () => {
  it("localizes itinerary day fields and service names", async () => {
    const product = {
      id: "prod_test",
      name: "Danube Delta Escape",
      description: "Base product description",
      inclusionsHtml: null,
      exclusionsHtml: null,
      termsHtml: null,
      contractTemplateId: null,
      status: "active",
      startDate: null,
      endDate: null,
      sellCurrency: "EUR",
      supplierId: null,
      tags: [],
    }
    const itinerary = {
      id: "itinerary_test",
      productId: product.id,
      name: "Default itinerary",
      isDefault: true,
      sortOrder: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }
    const day = {
      id: "day_test",
      itineraryId: itinerary.id,
      dayNumber: 1,
      title: "Arrival",
      description: "Board the boat.",
      location: "Tulcea",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }
    const service = {
      id: "service_test",
      dayId: day.id,
      supplierServiceId: null,
      serviceType: "transport",
      name: "Private transfer",
      description: "Base transfer copy",
      countryCode: "RO",
      costCurrency: "EUR",
      costAmountCents: 10000,
      quantity: 1,
      sortOrder: 0,
      notes: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }

    const db = createDb(
      new Map<unknown, unknown[]>([
        [products, [product]],
        [productOptions, []],
        [productMedia, []],
        [productItineraries, [itinerary]],
        [productTranslations, []],
        [productDays, [day]],
        [
          productDayTranslations,
          [
            {
              id: "day_trn_test",
              dayId: day.id,
              languageTag: "ro-RO",
              title: "Sosire",
              description: "Imbarcare pe barca.",
              location: "Tulcea",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        ],
        [productDayServices, [service]],
        [
          productDayServiceTranslations,
          [
            {
              id: "service_trn_test",
              serviceId: service.id,
              languageTag: "ro-RO",
              name: "Transfer privat",
              description: "Copie localizata",
              notes: null,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        ],
        [productOptionTranslations, []],
      ]),
    )

    const result = await buildOwnedProductContent(db as unknown as AnyDrizzleDb, product.id, {
      preferredLocales: ["ro-RO", "en-US"],
    })

    expect(result?.content.days).toEqual([
      {
        day_number: 1,
        title: "Sosire",
        description: "Imbarcare pe barca.",
        location: "Tulcea",
        hero_image_url: null,
        services: ["Transfer privat"],
      },
    ])
  })
})
