import { describe, expect, it } from "vitest"
import { normalizeCustomFieldVisibility } from "./target-capabilities.js"

describe("custom-field target capabilities", () => {
  it("forces unsupported reader visibility flags off", () => {
    expect(
      normalizeCustomFieldVisibility(
        { capabilities: ["read", "write"] },
        { isSearchable: true, isExportable: true, isInvoiceable: true },
      ),
    ).toEqual({ isSearchable: false, isExportable: false, isInvoiceable: false })
  })

  it("preserves flags that the selected target explicitly supports", () => {
    expect(
      normalizeCustomFieldVisibility(
        { capabilities: ["read", "search", "export", "invoice"] },
        { isSearchable: true, isExportable: true, isInvoiceable: true },
      ),
    ).toEqual({ isSearchable: true, isExportable: true, isInvoiceable: true })
  })
})
