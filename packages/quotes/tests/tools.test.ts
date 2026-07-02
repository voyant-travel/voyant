import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type QuotesToolServices, quotesTools } from "../src/tools.js"

function ctx(
  services?: Partial<QuotesToolServices>,
): ToolContext & { quotes?: QuotesToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    quotes: services as QuotesToolServices | undefined,
  }
}

describe("quotes tools", () => {
  it("registers read tools (quotes:read) + an accept action (quotes:write)", () => {
    const manifest = createToolRegistry()
    manifest.registerAll(quotesTools)
    const list = manifest.list()
    expect(list.map((t) => t.name).sort()).toEqual([
      "accept_quote_version",
      "get_quote",
      "list_quotes",
    ])
    const accept = list.find((t) => t.name === "accept_quote_version")
    expect(accept?.tier).toBe("write")
    expect(accept?.requiredScopes).toEqual(["quotes:write"])
    expect(accept?.riskPolicy.confirmationRequired).toBe(true)
    for (const t of list.filter((x) => x.name !== "accept_quote_version")) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["quotes:read"])
    }
  })

  it("dispatches reads + accept through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(quotesTools)
    const services: QuotesToolServices = {
      async listQuotes() {
        return { data: [] }
      },
      async getQuoteById(id) {
        return { id }
      },
      async acceptQuoteVersion(quoteVersionId) {
        return { id: quoteVersionId, status: "accepted" }
      },
    }
    expect(await registry.dispatch("get_quote", { id: "quo_1" }, ctx(services))).toMatchObject({
      id: "quo_1",
    })
    expect(
      await registry.dispatch("accept_quote_version", { quoteVersionId: "qv_1" }, ctx(services)),
    ).toMatchObject({ id: "qv_1", status: "accepted" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(quotesTools)
    await expect(registry.dispatch("list_quotes", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
