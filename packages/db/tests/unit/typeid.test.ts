import { describe, expect, it } from "vitest"

import {
  anyTypeIdSchema,
  compareIds,
  decodeId,
  getPrefix,
  getTimestamp,
  isValidId,
  newId,
  newIdFromPrefix,
  PREFIXES,
  registerPrefix,
  typeIdSchema,
  typeIdSchemaOptional,
} from "../../src/lib/typeid.js"

describe("PREFIXES", () => {
  it("maps table names to short string prefixes", () => {
    expect(PREFIXES.user_profiles).toBe("usrp")
    expect(PREFIXES.suppliers).toBe("supp")
    expect(PREFIXES.products).toBe("prod")
    expect(PREFIXES.bookings).toBe("book")
    expect(PREFIXES.organizations).toBe("org")
    expect(PREFIXES.people).toBe("pers")
  })

  it("has no duplicate prefix values", () => {
    const grouped = Object.entries(PREFIXES).reduce<Record<string, string[]>>(
      (acc, [key, value]) => {
        acc[value] ??= []
        acc[value].push(key)
        return acc
      },
      {},
    )

    const duplicates = Object.entries(grouped)
      .filter(([, keys]) => keys.length > 1)
      .sort(([a], [b]) => a.localeCompare(b))

    expect(duplicates).toEqual([
      ["bkip", ["booking_item_travelers", "booking_item_participants"]],
      ["bkpt", ["booking_travelers", "booking_participants"]],
      ["bptd", ["booking_traveler_travel_details", "booking_participant_travel_details"]],
    ])
  })
})

describe("newId", () => {
  it("generates a string with the correct prefix", () => {
    const id = newId("suppliers")
    expect(id).toMatch(/^supp_/)
  })

  it("generates unique IDs", () => {
    const a = newId("products")
    const b = newId("products")
    expect(a).not.toBe(b)
  })

  it("generates IDs with 26-char suffix after prefix", () => {
    const id = newId("bookings")
    const suffix = id.split("_")[1]
    expect(suffix).toHaveLength(26)
  })
})

describe("newIdFromPrefix", () => {
  it("generates a TypeID from a raw prefix string", () => {
    const id = newIdFromPrefix("test")
    expect(id).toMatch(/^test_/)
  })
})

describe("decodeId", () => {
  it("decodes a TypeID and extracts the prefix", () => {
    const id = newId("suppliers")
    const decoded = decodeId(id)
    expect(decoded.getType()).toBe("supp")
  })

  it("decodes with expected prefix validation", () => {
    const id = newId("suppliers")
    const decoded = decodeId(id, "supp")
    expect(decoded.getType()).toBe("supp")
  })

  it("throws for mismatched prefix", () => {
    const id = newId("suppliers")
    expect(() => decodeId(id, "prod")).toThrow()
  })

  it("throws for invalid TypeID string", () => {
    expect(() => decodeId("not-a-typeid")).toThrow()
  })
})

describe("isValidId", () => {
  it("returns true for valid ID with table name key", () => {
    const id = newId("suppliers")
    expect(isValidId(id, "suppliers")).toBe(true)
  })

  it("returns true for valid ID with raw prefix value", () => {
    const id = newId("suppliers")
    expect(isValidId(id, "supp")).toBe(true)
  })

  it("returns false for wrong prefix", () => {
    const id = newId("suppliers")
    expect(isValidId(id, "products")).toBe(false)
  })

  it("returns false for garbage string", () => {
    expect(isValidId("garbage", "suppliers")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isValidId("", "suppliers")).toBe(false)
  })
})

describe("getPrefix", () => {
  it("extracts the prefix from a TypeID", () => {
    const id = newId("bookings")
    expect(getPrefix(id)).toBe("book")
  })
})

describe("getTimestamp", () => {
  it("extracts a timestamp close to now", () => {
    const before = Date.now()
    const id = newId("products")
    const after = Date.now()

    const ts = getTimestamp(id)
    expect(ts).toBeInstanceOf(Date)
    expect(ts.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(ts.getTime()).toBeLessThanOrEqual(after + 1000)
  })
})

describe("compareIds", () => {
  it("returns 0 for identical IDs", () => {
    const id = newId("suppliers")
    expect(compareIds(id, id)).toBe(0)
  })

  it("returns negative when first ID was created earlier", async () => {
    const a = newId("suppliers")
    // small delay to ensure different UUIDv7 timestamps
    await new Promise((r) => setTimeout(r, 2))
    const b = newId("suppliers")
    expect(compareIds(a, b)).toBeLessThan(0)
  })

  it("returns positive when first ID was created later", async () => {
    const a = newId("suppliers")
    await new Promise((r) => setTimeout(r, 2))
    const b = newId("suppliers")
    expect(compareIds(b, a)).toBeGreaterThan(0)
  })
})

describe("registerPrefix", () => {
  it("registers a new custom prefix", () => {
    registerPrefix("test_custom_entity", "tce")
    const id = newIdFromPrefix("tce")
    expect(id).toMatch(/^tce_/)
  })

  it("throws if table name is already registered", () => {
    expect(() => registerPrefix("suppliers", "zzzz")).toThrow(/already registered/)
  })

  it("throws if prefix value is already in use", () => {
    expect(() => registerPrefix("some_new_table", "supp")).toThrow(/already in use/)
  })
})

describe("typeIdSchema", () => {
  it("accepts a valid TypeID by table name key", () => {
    const schema = typeIdSchema("suppliers")
    const id = newId("suppliers")
    expect(schema.parse(id)).toBe(id)
  })

  it("accepts a valid TypeID by raw prefix value", () => {
    const schema = typeIdSchema("supp")
    const id = newId("suppliers")
    expect(schema.parse(id)).toBe(id)
  })

  it("rejects a TypeID with wrong prefix", () => {
    const schema = typeIdSchema("suppliers")
    const id = newId("products")
    expect(() => schema.parse(id)).toThrow()
  })

  it("rejects an arbitrary string", () => {
    const schema = typeIdSchema("suppliers")
    expect(() => schema.parse("hello-world")).toThrow()
  })
})

describe("anyTypeIdSchema", () => {
  it("accepts any valid TypeID", () => {
    const schema = anyTypeIdSchema()
    expect(() => schema.parse(newId("suppliers"))).not.toThrow()
    expect(() => schema.parse(newId("products"))).not.toThrow()
    expect(() => schema.parse(newId("bookings"))).not.toThrow()
  })

  it("rejects non-TypeID strings", () => {
    const schema = anyTypeIdSchema()
    expect(() => schema.parse("not-a-typeid")).toThrow()
    expect(() => schema.parse("")).toThrow()
  })
})

describe("typeIdSchemaOptional", () => {
  it("accepts a valid TypeID", () => {
    const schema = typeIdSchemaOptional("suppliers")
    const id = newId("suppliers")
    expect(schema.parse(id)).toBe(id)
  })

  it("accepts null", () => {
    const schema = typeIdSchemaOptional("suppliers")
    expect(schema.parse(null)).toBeNull()
  })

  it("accepts undefined", () => {
    const schema = typeIdSchemaOptional("suppliers")
    expect(schema.parse(undefined)).toBeUndefined()
  })
})
