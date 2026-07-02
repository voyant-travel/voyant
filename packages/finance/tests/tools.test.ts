import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type FinanceToolServices, financeTools } from "../src/tools.js"

function ctx(
  services?: Partial<FinanceToolServices>,
): ToolContext & { finance?: FinanceToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    finance: services as FinanceToolServices | undefined,
  }
}

describe("finance tools", () => {
  it("registers read tools gated on finance:read", () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual(["get_invoice", "list_invoices"])
    for (const t of list) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["finance:read"])
    }
  })

  it("dispatches through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const result = await registry.dispatch(
      "get_invoice",
      { id: "inv_1" },
      ctx({
        async listInvoices() {
          return { data: [] }
        },
        async getInvoiceById(id) {
          return { id }
        },
      }),
    )
    expect(result).toMatchObject({ id: "inv_1" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    await expect(registry.dispatch("list_invoices", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
