import { describe, expect, it } from "vitest"

import { createInventoryAdminExtension } from "../../src/admin/index.js"

describe("Inventory React admin", () => {
  it("exports the operated authoring admin extension", () => {
    expect(typeof createInventoryAdminExtension).toBe("function")
  })
})
