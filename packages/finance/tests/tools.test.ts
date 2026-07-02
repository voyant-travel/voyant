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
  it("registers read tools (finance:read) + a destructive void action (finance:void)", () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual(["get_invoice", "list_invoices", "void_invoice"])
    const voidTool = list.find((t) => t.name === "void_invoice")
    expect(voidTool?.tier).toBe("destructive")
    expect(voidTool?.requiredScopes).toEqual(["finance:void"])
    expect(voidTool?.riskPolicy).toMatchObject({ destructive: true, confirmationRequired: true })
    for (const t of list.filter((x) => x.name !== "void_invoice")) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["finance:read"])
    }
  })

  it("dispatches reads + void through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const services: FinanceToolServices = {
      async listInvoices() {
        return { data: [] }
      },
      async getInvoiceById(id) {
        return { id }
      },
      async voidInvoice(id, input) {
        return { id, status: "voided", reason: input.reason ?? null }
      },
    }
    expect(await registry.dispatch("get_invoice", { id: "inv_1" }, ctx(services))).toMatchObject({
      id: "inv_1",
    })
    expect(
      await registry.dispatch("void_invoice", { id: "inv_2", reason: "dup" }, ctx(services)),
    ).toMatchObject({ id: "inv_2", status: "voided", reason: "dup" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    await expect(registry.dispatch("list_invoices", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
