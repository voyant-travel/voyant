import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { formatScopeLabel, ScopeLabel, shouldUpgradeManagedInstallation } from "./consent-screen.js"

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

describe("managed Marketplace consent action", () => {
  const activeInstallation = {
    id: "installation_1",
    releaseId: "release_1",
    status: "active" as const,
  }

  it("upgrades an active installation when the verified intent admits a different release", () => {
    expect(shouldUpgradeManagedInstallation("opaque-intent", activeInstallation, "release_2")).toBe(
      true,
    )
  })

  it("keeps fresh and idempotent installs on the install path", () => {
    expect(shouldUpgradeManagedInstallation("opaque-intent", null, "release_2")).toBe(false)
    expect(shouldUpgradeManagedInstallation("opaque-intent", activeInstallation, "release_1")).toBe(
      false,
    )
    expect(shouldUpgradeManagedInstallation(undefined, activeInstallation, "release_2")).toBe(false)
  })
})
