import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { formatScopeLabel, ScopeLabel } from "./consent-screen.js"

describe("consent scope labels", () => {
  it.each([
    ["finance-documents:read", "Read finance documents"],
    ["finance-document-artifacts:write", "Write finance document artifacts"],
    ["provider-connections:manage", "Manage provider connections"],
    ["customer-records:delete", "Delete customer records"],
    ["invoice-issuance:execute", "Execute invoice issuance"],
  ])("renders %s as human-readable consent copy", (scope, label) => {
    expect(formatScopeLabel(scope)).toBe(label)
  })

  it("retains the raw scope as secondary technical detail", () => {
    const html = renderToStaticMarkup(<ScopeLabel scope="finance-documents:read" />)
    expect(html).toContain("Read finance documents")
    expect(html).toContain("finance-documents:read")
  })
})
