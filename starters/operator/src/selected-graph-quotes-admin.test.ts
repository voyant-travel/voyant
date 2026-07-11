import { operatorAdminNavMessages } from "@voyant-travel/i18n"
import { FileText } from "lucide-react"
import { describe, expect, it } from "vitest"

import { selectedGraphAdminExtensionFactories } from "../.voyant/admin/selected-graph-admin.generated.js"
import { generatedAdminExtensionFactories } from "./admin.extensions.generated.js"
import { createOperatorAdminExtensions } from "./lib/admin-extensions.js"

describe("selected-graph Quotes admin composition", () => {
  it("uses the selected package factory without compatibility duplication", () => {
    expect(selectedGraphAdminExtensionFactories["@voyant-travel/quotes"]).toBeTypeOf("function")
    expect("quotes" in generatedAdminExtensionFactories).toBe(false)
  })

  it("preserves Quotes navigation, routes, destinations, and host wrappers", () => {
    const extension = createOperatorAdminExtensions(operatorAdminNavMessages.ro.nav).find(
      ({ id }) => id === "quotes",
    )

    expect(extension?.navigation).toEqual([
      {
        insertAfter: "bookings",
        items: [
          {
            id: "quotes",
            title: "Oferte",
            url: "/quotes",
            icon: FileText,
          },
        ],
      },
    ])
    expect(
      extension?.routes?.map(
        ({ id, path, title, destination, destinationParams, ssr, routeMessagesProvider }) => ({
          id,
          path,
          title,
          destination,
          destinationParams,
          ssr,
          hasRouteMessagesProvider: typeof routeMessagesProvider === "function",
        }),
      ),
    ).toEqual([
      {
        id: "quotes-index",
        path: "/quotes",
        title: "Oferte",
        destination: "quote.list",
        destinationParams: undefined,
        ssr: "data-only",
        hasRouteMessagesProvider: true,
      },
      {
        id: "quotes-detail",
        path: "/quotes/$id",
        title: "Oferte",
        destination: "quote.detail",
        destinationParams: { id: "quoteId" },
        ssr: "data-only",
        hasRouteMessagesProvider: true,
      },
    ])
  })
})
