import { describe, expect, it } from "vitest"

import {
  publicCatalogProductDetailSchema,
  publicCatalogProductSummarySchema,
} from "./validation-public.js"

const publicProductSummary = {
  id: "prod_01j00000000000000000000000",
  name: "Danube Cruise",
  description: "River cruise through major capitals.",
  inclusionsHtml: "<p>Transfers included</p>",
  exclusionsHtml: "<p>Flights excluded</p>",
  termsHtml: "<p>Standard cruise terms</p>",
  contentLanguageTag: null,
  slug: "danube-cruise",
  shortDescription: null,
  seoTitle: null,
  seoDescription: null,
  bookingMode: "date",
  capacityMode: "limited",
  visibility: "public",
  sellCurrency: "EUR",
  sellAmountCents: null,
  startDate: null,
  endDate: null,
  pax: null,
  contractTemplateId: null,
  productType: null,
  categories: [],
  tags: [],
  capabilities: [],
  destinations: [],
  locations: [],
  coverMedia: null,
  isFeatured: false,
} as const

describe("public catalog product validation", () => {
  it("preserves product HTML fields on public summary responses", () => {
    const parsed = publicCatalogProductSummarySchema.parse(publicProductSummary)

    expect(parsed.inclusionsHtml).toBe("<p>Transfers included</p>")
    expect(parsed.exclusionsHtml).toBe("<p>Flights excluded</p>")
    expect(parsed.termsHtml).toBe("<p>Standard cruise terms</p>")
  })

  it("preserves product HTML fields on public detail responses", () => {
    const parsed = publicCatalogProductDetailSchema.parse({
      ...publicProductSummary,
      brochure: null,
      openGraphImage: null,
      media: [],
      features: [],
      faqs: [],
    })

    expect(parsed.inclusionsHtml).toBe("<p>Transfers included</p>")
    expect(parsed.exclusionsHtml).toBe("<p>Flights excluded</p>")
    expect(parsed.termsHtml).toBe("<p>Standard cruise terms</p>")
  })
})
