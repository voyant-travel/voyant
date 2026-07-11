import { FileText } from "lucide-react"
import { describe, expect, it } from "vitest"

import { quotesVoyantModule } from "../../../quotes/src/voyant.js"
import { createQuotesAdminExtension, createSelectedQuotesAdminExtension } from "./index.js"

describe("quotes admin deployment facets", () => {
  it("tracks the package-owned extension routes and copy provider", () => {
    const extension = createQuotesAdminExtension()
    expect(quotesVoyantModule.admin?.runtime).toEqual({
      entry: "@voyant-travel/quotes-react/admin",
      export: "createSelectedQuotesAdminExtension",
    })
    expect(quotesVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(extension.routes?.map((route) => route.destination)).toEqual([
      "quote.list",
      "quote.detail",
    ])
    expect(quotesVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual(
      extension.routes?.map(() => ({
        entry: "@voyant-travel/quotes-react/admin",
        export: "createSelectedQuotesAdminExtension",
      })),
    )
    expect(quotesVoyantModule.admin?.copy).toEqual([
      {
        id: "@voyant-travel/quotes#admin.copy",
        namespace: "quotes.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/quotes-react/i18n",
          export: "crmUiMessageDefinitions",
        },
      },
    ])
    expect(
      extension.routes?.every((route) => typeof route.routeMessagesProvider === "function"),
    ).toBe(true)
  })

  it("owns the selected Operator label and icon adapter", () => {
    const extension = createSelectedQuotesAdminExtension({ navMessages: { quotes: "Oferte" } })

    expect(extension.navigation?.[0]?.items[0]).toMatchObject({ title: "Oferte", icon: FileText })
    expect(extension.routes?.map((route) => route.title)).toEqual(["Oferte", "Oferte"])
  })
})
