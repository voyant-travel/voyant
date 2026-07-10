import { describe, expect, it } from "vitest"
import { quotesBookingVoyantPlugin, quotesVoyantModule } from "../../src/voyant.js"

describe("quotes deployment manifests", () => {
  it("owns the module runtime, persistence, and link facets", () => {
    expect(quotesVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/quotes",
      packageName: "@voyant-travel/quotes",
      api: [
        {
          id: "@voyant-travel/quotes#api",
          surface: "admin",
          mount: "@voyant-travel/quotes",
          transactional: true,
          runtime: { entry: "@voyant-travel/quotes", export: "createQuotesHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/quotes#schema" }],
      migrations: [{ id: "@voyant-travel/quotes#migrations" }],
      links: [
        { id: "@voyant-travel/quotes#linkable.quote" },
        { id: "@voyant-travel/quotes#linkable.quoteVersion" },
      ],
    })
  })

  it("owns the booking extension", () => {
    expect(quotesBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/quotes#booking-extension",
      packageName: "@voyant-travel/quotes",
      api: [
        {
          id: "@voyant-travel/quotes#booking-extension.api",
          mount: "@voyant-travel/quotes/booking-extension",
          runtime: {
            entry: "@voyant-travel/quotes/booking-extension",
            export: "quotesBookingExtension",
          },
        },
      ],
    })
  })
})
