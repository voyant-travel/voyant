import { describe, expect, it } from "vitest"

import {
  ContractDetailHost,
  ContractDialog,
  ContractsHost,
  createLegalAdminExtension,
  NumberSeriesDialog,
  NumberSeriesHost,
  PoliciesHost,
  PolicyAssignmentDialog,
  PolicyDetailHost,
  PolicyDialog,
  TemplateDetailHost,
  TemplatesHost,
} from "./index.js"

describe("createLegalAdminExtension", () => {
  it("contributes no navigation (legal nav is base-nav-owned)", () => {
    const extension = createLegalAdminExtension()
    expect(extension.id).toBe("legal")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the legal routes with unique ids and paths", () => {
    const extension = createLegalAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(7)
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length)
    expect(routes.map((route) => route.path)).toEqual([
      "/legal/contracts",
      "/legal/contracts/$id",
      "/legal/templates",
      "/legal/templates/$id",
      "/legal/policies",
      "/legal/policies/$id",
      "/legal/number-series",
    ])
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
    const routes = extension.routes ?? []
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
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
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
