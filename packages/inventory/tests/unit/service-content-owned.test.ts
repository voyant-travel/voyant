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

describe("buildOwnedProductContent", () => {
  it("localizes itinerary days and day-service labels", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [
          products,
          [
            {
              id: "prod_1",
              name: "Base tour",
              status: "active",
              description: "Base description",
              inclusionsHtml: null,
              exclusionsHtml: null,
              termsHtml: null,
              contractTemplateId: null,
              startDate: null,
              endDate: null,
              sellCurrency: "EUR",
              supplierId: null,
              tags: [],
            },
          ],
        ],
        [productOptions, []],
        [productOptionTranslations, []],
        [productMedia, []],
        [
          productTranslations,
          [
            {
              productId: "prod_1",
              languageTag: "ro-RO",
              name: "Tur localizat",
              shortDescription: "Descriere scurta",
              description: "Descriere localizata",
              inclusionsHtml: null,
              exclusionsHtml: null,
              termsHtml: null,
            },
          ],
        ],
        [
          productItineraries,
          [
            {
              id: "itin_1",
              productId: "prod_1",
              name: "Default",
              isDefault: true,
              sortOrder: 0,
            },
          ],
        ],
        [
          productDays,
          [
            {
              id: "day_1",
              itineraryId: "itin_1",
              dayNumber: 1,
              title: "Base day",
              description: "Base day description",
              location: "Base city",
            },
          ],
        ],
        [
          productDayTranslations,
          [
            {
              dayId: "day_1",
              languageTag: "ro-RO",
              title: "Zi localizata",
              description: "Descriere zi localizata",
              location: "Oras localizat",
            },
          ],
        ],
        [
          productDayServices,
          [
            {
              id: "svc_1",
              dayId: "day_1",
              serviceType: "activity",
              name: "Base activity",
              sortOrder: 0,
            },
          ],
        ],
        [
          productDayServiceTranslations,
          [
            {
              serviceId: "svc_1",
              languageTag: "ro-RO",
              name: "Activitate localizata",
              description: "Descriere serviciu localizata",
              notes: null,
            },
          ],
        ],
      ]),
    )

    const result = await buildOwnedProductContent(db, "prod_1", {
      preferredLocales: ["ro-RO", "en-GB"],
    })

    expect(result?.servedLocale).toBe("ro-RO")
    expect(result?.content.product.name).toBe("Tur localizat")
    expect(result?.content.days).toEqual([
      expect.objectContaining({
        day_number: 1,
        title: "Zi localizata",
        description: "Descriere zi localizata",
        location: "Oras localizat",
        services: ["Activitate localizata"],
      }),
    ])
  })
})

function fakeDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => selectable(rowsByTable.get(table) ?? []),
    }),
    execute: async () => [],
  } as never
}

function selectable(rows: unknown[]) {
  const chain = {
    where: () => promiseChain(rows),
    orderBy: async () => rows,
    limit: async (limit: number) => rows.slice(0, limit),
    offset: () => chain,
  }
  return chain
}

type QueryPromise = Promise<unknown[]> & {
  orderBy: () => Promise<unknown[]>
  limit: (limit: number) => Promise<unknown[]>
  offset: () => QueryPromise
}

function promiseChain(rows: unknown[]): QueryPromise {
  const promise = Promise.resolve(rows) as QueryPromise
  promise.orderBy = async () => rows
  promise.limit = async (limit: number) => rows.slice(0, limit)
  promise.offset = () => promise
  return promise
}
