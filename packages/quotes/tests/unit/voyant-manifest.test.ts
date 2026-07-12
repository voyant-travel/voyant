import { describe, expect, it } from "vitest"
import {
  createQuoteProposalPublicRoutes,
  QUOTE_PROPOSAL_OPENAPI_API_IDS,
} from "../../src/proposal-routes.js"
import {
  quotesBookingVoyantPlugin,
  quotesProposalVoyantPlugin,
  quotesVersionSnapshotVoyantPlugin,
  quotesVoyantModule,
} from "../../src/voyant.js"

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
          mount: "quotes",
          openapi: { document: "quotes" },
          transactional: true,
          runtime: { entry: "@voyant-travel/quotes", export: "createQuotesVoyantRuntime" },
        },
      ],
      schema: [{ id: "@voyant-travel/quotes#schema" }],
      migrations: [{ id: "@voyant-travel/quotes#migrations" }],
      admin: {
        runtime: {
          entry: "@voyant-travel/quotes-react/admin",
          export: "createSelectedQuotesAdminExtension",
        },
        copy: [
          {
            id: "@voyant-travel/quotes#admin.copy",
            namespace: "quotes.admin",
          },
        ],
        routes: [
          {
            id: "@voyant-travel/quotes#admin.route.quotes-index",
            path: "/quotes",
          },
          {
            id: "@voyant-travel/quotes#admin.route.quotes-detail",
            path: "/quotes/$id",
          },
        ],
      },
      links: [
        { id: "@voyant-travel/quotes#linkable.quote" },
        { id: "@voyant-travel/quotes#linkable.quoteVersion" },
      ],
    })
  })

  it("owns the booking extension", () => {
    expect(quotesBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/quotes#booking-extension",
      packageName: "@voyant-travel/quotes",
      api: [
        {
          id: "@voyant-travel/quotes#booking-extension.api",
          mount: "bookings",
          runtime: {
            entry: "@voyant-travel/quotes/booking-extension",
            export: "quotesBookingExtension",
          },
        },
      ],
    })
  })

  it("owns the proposal and quote-version snapshot bridges", () => {
    expect([quotesProposalVoyantPlugin, quotesVersionSnapshotVoyantPlugin]).toMatchObject([
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/quotes#proposal-extension",
        api: [
          {
            id: "@voyant-travel/quotes#proposal-extension.api.admin",
            surface: "admin",
            mount: "quote-versions",
            openapi: { document: "quotes" },
            runtime: {
              entry: "@voyant-travel/quotes",
              export: "createQuoteProposalVoyantRuntime",
            },
          },
          {
            surface: "public",
            mount: "proposals",
            anonymous: true,
            openapi: { document: "quotes-proposal-public" },
            runtime: {
              entry: "@voyant-travel/quotes",
              export: "createQuoteProposalVoyantRuntime",
            },
          },
        ],
      },
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/quotes#quote-version-snapshot-extension",
        api: [
          {
            surface: "admin",
            mount: "trips",
            runtime: {
              entry: "@voyant-travel/quotes",
              export: "createQuoteVersionSnapshotVoyantRuntime",
            },
          },
        ],
      },
    ])

    const document = (
      createQuoteProposalPublicRoutes({} as never) as OpenApiDocumentSource
    ).getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Public quote proposals", version: "1" },
    })
    const operations = Object.values(document.paths ?? {}).flatMap((path) =>
      Object.values(path).filter((operation) => typeof operation === "object"),
    ) as Array<Record<string, unknown>>
    expect(operations).toHaveLength(4)
    expect(
      operations.every(
        (operation) => operation["x-voyant-api-id"] === QUOTE_PROPOSAL_OPENAPI_API_IDS.public,
      ),
    ).toBe(true)
  })
})

interface OpenApiDocumentSource {
  getOpenAPI31Document(input: { openapi: "3.1.0"; info: { title: string; version: string } }): {
    paths?: Record<string, Record<string, unknown>>
  }
}
