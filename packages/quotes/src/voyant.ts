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
  events: [
    { id: "@voyant-travel/quotes#event.quote-created", eventType: "quote.created" },
    { id: "@voyant-travel/quotes#event.quote-updated", eventType: "quote.updated" },
    { id: "@voyant-travel/quotes#event.quote-deleted", eventType: "quote.deleted" },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/quotes#access.quotes",
        resource: "quotes",
        actions: ["read", "write"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/quotes#tool.list-quotes",
      name: "list_quotes",
      runtime: { entry: "@voyant-travel/quotes/tools", export: "listQuotesTool" },
      requiredScopes: ["quotes:read"],
      context: ["quotes"],
      risk: "low",
    },
    {
      id: "@voyant-travel/quotes#tool.get-quote",
      name: "get_quote",
      runtime: { entry: "@voyant-travel/quotes/tools", export: "getQuoteTool" },
      requiredScopes: ["quotes:read"],
      context: ["quotes"],
      risk: "low",
    },
    {
      id: "@voyant-travel/quotes#tool.accept-quote-version",
      name: "accept_quote_version",
      runtime: { entry: "@voyant-travel/quotes/tools", export: "acceptQuoteVersionTool" },
      requiredScopes: ["quotes:write"],
      context: ["quotes"],
      risk: "medium",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/quotes#action.list-quotes",
      version: "v1",
      kind: "read",
      targetType: "quote",
      requiredScopes: ["quotes:read"],
      risk: "low",
      ledger: "optional",
      from: { tools: ["@voyant-travel/quotes#tool.list-quotes"] },
    },
    {
      id: "@voyant-travel/quotes#action.get-quote",
      version: "v1",
      kind: "read",
      targetType: "quote",
      requiredScopes: ["quotes:read"],
      risk: "low",
      ledger: "optional",
      from: { tools: ["@voyant-travel/quotes#tool.get-quote"] },
    },
    {
      id: "@voyant-travel/quotes#action.accept-quote-version",
      version: "v1",
      kind: "execute",
      targetType: "quote-version",
      requiredScopes: ["quotes:write"],
      risk: "medium",
      ledger: "optional",
      approval: "required",
      reversible: false,
      from: { tools: ["@voyant-travel/quotes#tool.accept-quote-version"] },
    },
  ],
  admin: {
    copy: [
      {
        id: "@voyant-travel/quotes#admin.copy",
        namespace: "quotes.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/quotes-react/i18n",
          export: "crmUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/quotes#admin.route.quotes-index",
        path: "/quotes",
        runtime: {
          entry: "@voyant-travel/quotes-react/admin",
          export: "createQuotesAdminExtension",
        },
      },
      {
        id: "@voyant-travel/quotes#admin.route.quotes-detail",
        path: "/quotes/$id",
        runtime: {
          entry: "@voyant-travel/quotes-react/admin",
          export: "createQuotesAdminExtension",
        },
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
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
