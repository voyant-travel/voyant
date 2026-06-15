import { describe, expect, it } from "vitest"

import * as schema from "./schema.js"

describe("distribution schema exports", () => {
  it("includes supplier and external reference tables in the public schema surface", () => {
    expect(schema.externalRefs).toBeDefined()
    expect(schema.suppliers).toBeDefined()
    expect(schema.supplierDirectoryProjections).toBeDefined()
    expect(schema.supplierServices).toBeDefined()
    expect(schema.supplierRates).toBeDefined()
    expect(schema.supplierNotes).toBeDefined()
    expect(schema.supplierAvailability).toBeDefined()
    expect(schema.supplierContracts).toBeDefined()
  })
})
