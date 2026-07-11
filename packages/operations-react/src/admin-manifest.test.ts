import { describe, expect, it } from "vitest"

import { operationsVoyantModule } from "../../operations/src/voyant.js"
import { createOperationsAdminExtension } from "./admin.js"

describe("operations admin deployment facets", () => {
  it("tracks the package-owned extension routes and copy providers", () => {
    const extension = createOperationsAdminExtension()
    expect(operationsVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(operationsVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual(
      extension.routes?.map(() => ({
        entry: "@voyant-travel/operations-react/admin",
        export: "createOperationsAdminExtension",
      })),
    )
    expect(operationsVoyantModule.admin?.copy?.map((copy) => copy.runtime)).toEqual([
      {
        entry: "@voyant-travel/operations-react/availability/i18n",
        export: "availabilityUiMessageDefinitions",
      },
      {
        entry: "@voyant-travel/operations-react/resources/i18n",
        export: "resourcesUiMessageDefinitions",
      },
    ])
    expect(extension.widgets?.map((widget) => widget.slot)).toContain(
      "product.details.option-extras",
    )
    expect(operationsVoyantModule.admin?.contributions?.map((item) => item.slotId)).toContain(
      "product.details.option-extras",
    )
  })
})
