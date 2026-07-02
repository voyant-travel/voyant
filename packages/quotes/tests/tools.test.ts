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
  it("registers read tools gated on quotes:read", () => {
    const manifest = createToolRegistry()
    manifest.registerAll(quotesTools)
    const list = manifest.list()
    expect(list.map((t) => t.name).sort()).toEqual(["get_quote", "list_quotes"])
    for (const t of list) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["quotes:read"])
    }
  })

  it("dispatches through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(quotesTools)
    const result = await registry.dispatch(
      "get_quote",
      { id: "quo_1" },
      ctx({
        async listQuotes() {
          return { data: [] }
        },
        async getQuoteById(id) {
          return { id }
        },
      }),
    )
    expect(result).toMatchObject({ id: "quo_1" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(quotesTools)
    await expect(registry.dispatch("list_quotes", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
