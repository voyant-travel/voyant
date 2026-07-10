import { describe, expect, it } from "vitest"

import { actionLedgerVoyantModule } from "../../action-ledger/src/voyant.js"
import { createActionLedgerAdminExtension } from "../src/admin/index.js"

describe("createActionLedgerAdminExtension", () => {
  it("keeps the package-owned route facet aligned with the admin extension", () => {
    const extension = createActionLedgerAdminExtension()
    expect(actionLedgerVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(actionLedgerVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual([
      {
        entry: "@voyant-travel/action-ledger-react/admin",
        export: "createActionLedgerAdminExtension",
      },
    ])
  })

  it("contributes the Logs nav item with the default order", () => {
    const extension = createActionLedgerAdminExtension()
    expect(extension.id).toBe("action-ledger")
    const contribution = extension.navigation?.[0]
    expect(contribution?.order).toBe(60)
    const item = contribution?.items[0]
    expect(item?.id).toBe("action-ledger")
    expect(item?.url).toBe("/action-ledger")
  })

  it("describes the single Logs route", () => {
    const extension = createActionLedgerAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(1)
    expect(routes[0]?.id).toBe("action-ledger-index")
    expect(routes[0]?.path).toBe("/action-ledger")
  })

  it("honors path, labels, and order", () => {
    const extension = createActionLedgerAdminExtension({
      path: "/logs",
      labels: { actionLedger: "Jurnal" },
      order: 75,
    })
    const contribution = extension.navigation?.[0]
    expect(contribution?.order).toBe(75)
    expect(contribution?.items[0]?.title).toBe("Jurnal")
    expect(contribution?.items[0]?.url).toBe("/logs")
    expect(extension.routes?.[0]?.path).toBe("/logs")
    expect(extension.routes?.[0]?.title).toBe("Jurnal")
  })

  it("carries no search contract (filters stay component-local)", () => {
    const extension = createActionLedgerAdminExtension()
    expect(extension.routes?.[0]?.validateSearch).toBeUndefined()
  })

  it("carries a lazy page loader instead of an eager component", async () => {
    // The full route implementation lives on the contribution (RFC §4.8):
    // `page` resolves the page module lazily so it stays code-split; no
    // eager `component` reference pins it into the workspace-chrome chunk.
    const extension = createActionLedgerAdminExtension()
    const route = extension.routes?.[0]
    expect(route?.component).toBeUndefined()
    expect(typeof route?.page).toBe("function")
    const module = await route?.page?.()
    expect(typeof module?.default).toBe("function")
  }, 15_000)

  it("attaches a first-page loader and marks the route data-only for SSR", () => {
    const extension = createActionLedgerAdminExtension()
    const route = extension.routes?.[0]
    expect(typeof route?.loader).toBe("function")
    expect(route?.ssr).toBe("data-only")
  })
})
