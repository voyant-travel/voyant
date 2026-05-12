import { describe, expect, it } from "vitest"

import {
  renderStructuredTemplate,
  validateStructuredTemplateSyntax,
} from "../src/template-renderer.js"

describe("renderStructuredTemplate", () => {
  it("keeps simple mustache interpolation compatibility", () => {
    expect(
      renderStructuredTemplate("Hello {{ customer.name }}", "markdown", {
        customer: { name: "Ana" },
      }),
    ).toBe("Hello Ana")
    expect(renderStructuredTemplate("Data {{ obj }}", "markdown", { obj: { a: 1 } })).toBe(
      'Data {"a":1}',
    )
  })

  it("supports liquid control flow for html/markdown bodies", () => {
    const body =
      "{% if travelers.size > 0 %}{% for traveler in travelers %}{{ traveler.name }}{% unless forloop.last %}, {% endunless %}{% endfor %}{% else %}No travelers{% endif %}"
    expect(
      renderStructuredTemplate(body, "html", {
        travelers: [{ name: "Ana" }, { name: "Bob" }],
      }),
    ).toBe("Ana, Bob")
    expect(renderStructuredTemplate(body, "markdown", { travelers: [] })).toBe("No travelers")
  })

  it("supports liquid filters inside lexical text nodes", () => {
    const body = JSON.stringify({
      root: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Travelers: {{ travelers | json }}" }],
          },
        ],
      },
    })

    const output = renderStructuredTemplate(body, "lexical_json", {
      travelers: [{ name: "Ana" }],
    })

    expect(JSON.parse(output).root.children[0].children[0].text).toBe('Travelers: [{"name":"Ana"}]')
  })

  describe("currency filter", () => {
    it("formats decimal amounts with default EUR/en-US", () => {
      expect(
        renderStructuredTemplate("{{ total | currency }}", "markdown", { total: 123.45 }),
      ).toBe("€123.45")
    })

    it("honors currency + locale args", () => {
      // en-US uses "USD" as just "$"; ro-RO uses "EUR" as "123,45 €". Smoke-check
      // that the args round-trip — exact chars vary by ICU version so just
      // assert the amount and currency symbol appear.
      const out = renderStructuredTemplate('{{ total | currency: "USD", "en-US" }}', "markdown", {
        total: 1500,
      })
      expect(out).toContain("1,500.00")
      expect(out).toContain("$")
    })

    it("returns the raw value when it can't parse a number", () => {
      expect(renderStructuredTemplate("{{ total | currency }}", "markdown", { total: "n/a" })).toBe(
        "n/a",
      )
    })
  })

  describe("cents filter", () => {
    it("divides by 100 and formats", () => {
      expect(
        renderStructuredTemplate("{{ priceCents | cents }}", "markdown", { priceCents: 12345 }),
      ).toBe("€123.45")
    })

    it("accepts currency + locale overrides", () => {
      const out = renderStructuredTemplate('{{ priceCents | cents: "RON", "en-US" }}', "markdown", {
        priceCents: 50000,
      })
      expect(out).toContain("500.00")
      expect(out).toContain("RON")
    })
  })

  describe("format_date filter", () => {
    it("formats ISO strings with medium preset by default", () => {
      const out = renderStructuredTemplate("{{ d | format_date }}", "markdown", {
        d: "2026-07-01",
      })
      expect(out).toContain("Jul")
      expect(out).toContain("2026")
    })

    it("short preset uses numeric day/month", () => {
      const out = renderStructuredTemplate('{{ d | format_date: "short" }}', "markdown", {
        d: "2026-07-01",
      })
      expect(out).toMatch(/\d{2}/)
      expect(out).toContain("2026")
    })

    it("iso preset returns YYYY-MM-DD", () => {
      expect(
        renderStructuredTemplate('{{ d | format_date: "iso" }}', "markdown", {
          d: new Date("2026-07-01T12:34:56Z"),
        }),
      ).toBe("2026-07-01")
    })

    it("returns empty string for null/undefined", () => {
      expect(renderStructuredTemplate("[{{ d | format_date }}]", "markdown", { d: null })).toBe(
        "[]",
      )
    })

    it("returns the raw value when date is unparseable", () => {
      expect(
        renderStructuredTemplate("{{ d | format_date }}", "markdown", { d: "not-a-date" }),
      ).toBe("not-a-date")
    })
  })
})

describe("validateStructuredTemplateSyntax", () => {
  it("accepts valid Liquid and mustache bodies", () => {
    expect(
      validateStructuredTemplateSyntax(
        "{% if travelers.size > 0 %}{{ travelers[0].name }}{% endif %}",
        "html",
      ),
    ).toEqual([])
  })

  it("rejects rich-text-split Liquid output tags", () => {
    const issues = validateStructuredTemplateSyntax(
      '{{ </p><p>contract.signed_at | default: "-" }}',
      "html",
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain("expected")
  })

  it("checks Liquid syntax inside lexical text nodes", () => {
    const body = JSON.stringify({
      root: {
        children: [{ type: "text", text: "{% if customer %}Hi" }],
      },
    })

    const issues = validateStructuredTemplateSyntax(body, "lexical_json")

    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain("not closed")
  })
})
