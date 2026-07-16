import { describe, expect, it } from "vitest"
import {
  defaultFormValues,
  normalizeCustomFieldDefinitionFormValues,
} from "./custom-field-definition-sheet.js"

describe("custom-field definition sheet target capabilities", () => {
  it("defaults unsupported reader visibility flags to false", () => {
    expect(
      defaultFormValues({
        id: "booking",
        namespace: "bookings",
        label: "Booking",
        fieldTypes: ["text"],
        capabilities: ["read", "write"],
        ownerUnitId: "@voyant-travel/bookings",
      }),
    ).toMatchObject({ isSearchable: false, isExportable: false, isInvoiceable: false })
  })

  it("clears unsupported flags when the selected target changes", () => {
    expect(
      normalizeCustomFieldDefinitionFormValues(
        {
          id: "activity",
          namespace: "relationships",
          label: "Activity",
          fieldTypes: ["text"],
          capabilities: ["read", "write"],
          ownerUnitId: "@voyant-travel/relationships",
        },
        { isSearchable: true, isExportable: true, isInvoiceable: true },
      ),
    ).toEqual({ isSearchable: false, isExportable: false, isInvoiceable: false })
  })
})
