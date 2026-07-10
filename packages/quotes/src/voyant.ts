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
      mount: "@voyant-travel/quotes",
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
      mount: "@voyant-travel/quotes/booking-extension",
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

export default quotesVoyantModule
