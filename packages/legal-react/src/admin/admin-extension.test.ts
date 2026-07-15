import { describe, expect, it } from "vitest"

import { ContractDetailHost } from "./contract-detail-host.js"
import { ContractDialog } from "./contract-dialog.js"
import { ContractsHost } from "./contracts-host.js"
import { createLegalAdminExtension, createSelectedLegalAdminExtension } from "./index.js"
import { NumberSeriesDialog } from "./number-series-dialog.js"
import { NumberSeriesHost } from "./number-series-host.js"
import { PoliciesHost } from "./policies-host.js"
import { PolicyAssignmentDialog } from "./policy-assignment-dialog.js"
import { PolicyDetailHost } from "./policy-detail-host.js"
import { PolicyDialog } from "./policy-dialog.js"
import { TemplateDetailHost } from "./template-detail-host.js"
import { TemplatesHost } from "./templates-host.js"

describe("createLegalAdminExtension", () => {
  it("adds localized standard navigation only through the selected factory", () => {
    const extension = createLegalAdminExtension()
    expect(extension.id).toBe("legal")
    expect(extension.navigation).toBeUndefined()

    const selected = createSelectedLegalAdminExtension({
      navMessages: {
        legal: "Juridic",
        contracts: "Contracte",
        contractTemplates: "Sabloane",
        policies: "Politici",
        contractNumberSeries: "Serii",
      },
    })
    expect(selected.navigation?.[0]).toMatchObject({
      order: -40,
      items: [
        {
          id: "legal",
          title: "Juridic",
          url: "/legal/contracts",
          items: [
            { id: "contracts", title: "Contracte", url: "/legal/contracts" },
            { id: "contract-templates", title: "Sabloane", url: "/legal/templates" },
            { id: "policies", title: "Politici", url: "/legal/policies" },
            { id: "number-series", title: "Serii", url: "/legal/number-series" },
          ],
        },
      ],
    })
    expect(selected.navigation?.[0]?.items[0]?.icon).toBeDefined()
  })

  it("falls back to stable English selected navigation copy", () => {
    const extension = createSelectedLegalAdminExtension({ navMessages: {} })
    expect(extension.navigation?.[0]?.items[0]).toMatchObject({
      title: "Legal",
      items: [
        { title: "Contracts" },
        { title: "Contract templates" },
        { title: "Policies" },
        { title: "Number series" },
      ],
    })
  })

  it("describes the legal routes with unique ids and paths", () => {
    const extension = createLegalAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(8)
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length)
    expect(routes.map((route) => route.path)).toEqual([
      "/legal",
      "/legal/contracts",
      "/legal/contracts/$id",
      "/legal/templates",
      "/legal/templates/$id",
      "/legal/policies",
      "/legal/policies/$id",
      "/legal/number-series",
    ])
  })

  it("redirects the legal index to the contracts page", () => {
    const extension = createLegalAdminExtension()
    const index = extension.routes?.find((route) => route.id === "legal-index")
    expect(index?.path).toBe("/legal")
    expect(index?.redirectTo).toBe("/legal/contracts")
    expect(index?.page).toBeUndefined()
  })

  it("honors basePath and labels", () => {
    const extension = createLegalAdminExtension({
      basePath: "/juridic",
      labels: { contracts: "Contracte", policies: "Politici" },
    })
    const contractsIndex = extension.routes?.find((route) => route.id === "legal-contracts-index")
    expect(contractsIndex?.path).toBe("/juridic/contracts")
    expect(contractsIndex?.title).toBe("Contracte")
    const policiesDetail = extension.routes?.find((route) => route.id === "legal-policies-detail")
    expect(policiesDetail?.path).toBe("/juridic/policies/$id")
    expect(policiesDetail?.title).toBe("Politici")
  })

  it("carries full route implementations (lazy page + loader + data-only SSR)", () => {
    // RFC §4.8 endgame: contributions ship the implementation, hosts bind
    // them into their code-assembled route tree. Pages are lazy module
    // loaders (never eager `component` references) so they stay code-split.
    const extension = createLegalAdminExtension()
    const routes = (extension.routes ?? []).filter((route) => !route.redirectTo)
    expect(routes).toHaveLength(7)
    for (const route of routes) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      expect(typeof route.loader).toBe("function")
      expect(route.ssr).toBe("data-only")
    }
  })

  it("resolves every lazy page to a module with a default component", async () => {
    const extension = createLegalAdminExtension()
    for (const route of extension.routes ?? []) {
      if (route.redirectTo) continue
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
    }
  })

  it("contributes no widgets (no cross-domain legal card is slot-mounted today)", () => {
    const extension = createLegalAdminExtension()
    expect(extension.widgets).toBeUndefined()
  })
})

describe("packaged legal admin hosts", () => {
  // Importable + renderable component types — host apps bind these from
  // their SPECIFIC modules (the admin barrel re-exports types only, so the
  // workspace-chrome chunk that evaluates the factory never pins the heavy
  // hosts). A broken import surface fails here, not in an app build.
  it("exports the page hosts and dialogs as components from the admin entrypoint", () => {
    for (const host of [
      ContractDetailHost,
      ContractDialog,
      ContractsHost,
      NumberSeriesDialog,
      NumberSeriesHost,
      PoliciesHost,
      PolicyAssignmentDialog,
      PolicyDetailHost,
      PolicyDialog,
      TemplateDetailHost,
      TemplatesHost,
    ]) {
      expect(typeof host).toBe("function")
    }
  })
})
