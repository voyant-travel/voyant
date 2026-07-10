import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the quotes package. */
export const quotesVoyantModule = defineModule({
  id: "@voyant-travel/quotes",
  packageName: "@voyant-travel/quotes",
  localId: "quotes",
  api: [
    {
      id: "@voyant-travel/quotes#api",
      surface: "admin",
      mount: "quotes",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/quotes",
        export: "createQuotesHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/quotes#schema",
      source: "@voyant-travel/quotes/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/quotes#migrations",
      source: "./migrations",
    },
  ],
  links: [
    { id: "@voyant-travel/quotes#linkable.quote", source: "@voyant-travel/quotes/linkables" },
    {
      id: "@voyant-travel/quotes#linkable.quoteVersion",
      source: "@voyant-travel/quotes/linkables",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const quotesBookingVoyantPlugin = definePlugin({
  id: "@voyant-travel/quotes#booking-extension",
  packageName: "@voyant-travel/quotes",
  localId: "quotes.booking-extension",
  api: [
    {
      id: "@voyant-travel/quotes#booking-extension.api",
      surface: "admin",
      mount: "bookings",
      runtime: {
        entry: "@voyant-travel/quotes/booking-extension",
        export: "quotesBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const quotesProposalVoyantPlugin = definePlugin({
  id: "@voyant-travel/quotes#proposal-extension",
  packageName: "@voyant-travel/quotes",
  localId: "quotes.proposal-extension",
  api: [
    {
      id: "@voyant-travel/quotes#proposal-extension.api.admin",
      surface: "admin",
      mount: "quote-versions",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/quotes",
        export: "createQuoteProposalHonoExtension",
      },
    },
    {
      id: "@voyant-travel/quotes#proposal-extension.api.public",
      surface: "public",
      mount: "proposals",
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/quotes",
        export: "createQuoteProposalHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const quotesVersionSnapshotVoyantPlugin = definePlugin({
  id: "@voyant-travel/quotes#quote-version-snapshot-extension",
  packageName: "@voyant-travel/quotes",
  localId: "quotes.quote-version-snapshot-extension",
  api: [
    {
      id: "@voyant-travel/quotes#quote-version-snapshot-extension.api",
      surface: "admin",
      mount: "trips",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/quotes",
        export: "createQuoteVersionSnapshotHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default quotesVoyantModule
