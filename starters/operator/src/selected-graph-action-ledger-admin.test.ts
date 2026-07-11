import { operatorAdminNavMessages } from "@voyant-travel/i18n"
import { ScrollText } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  createSelectedGraphAdminExtensions,
  selectedGraphAdminExtensionFactories,
} from "../.voyant/admin/selected-graph-admin.generated.js"
import { generatedAdminExtensionFactories } from "./admin.extensions.generated.js"

describe("selected-graph Action Ledger admin composition", () => {
  it("uses the selected package factory without compatibility duplication", () => {
    expect(selectedGraphAdminExtensionFactories["@voyant-travel/action-ledger"]).toBeTypeOf(
      "function",
    )
    expect("actionLedger" in generatedAdminExtensionFactories).toBe(false)
    expect(
      createSelectedGraphAdminExtensions({ navMessages: operatorAdminNavMessages.en.nav }).map(
        ({ id }) => id,
      ),
    ).toEqual(["quotes", "mice", "action-ledger"])
  })

  it("preserves localized navigation, route copy, and icon behavior", () => {
    const extension = createSelectedGraphAdminExtensions({
      navMessages: operatorAdminNavMessages.ro.nav,
    }).find(({ id }) => id === "action-ledger")

    expect(extension?.navigation).toEqual([
      {
        order: 60,
        items: [
          {
            id: "action-ledger",
            title: "Jurnal actiuni",
            url: "/action-ledger",
            icon: ScrollText,
          },
        ],
      },
    ])
    expect(
      extension?.routes?.map(({ id, path, title, ssr }) => ({ id, path, title, ssr })),
    ).toEqual([
      {
        id: "action-ledger-index",
        path: "/action-ledger",
        title: "Jurnal actiuni",
        ssr: "data-only",
      },
    ])
  })
})
