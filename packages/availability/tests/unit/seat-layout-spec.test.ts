import { describe, expect, it } from "vitest"

import {
  parseLayoutSpecFromFlags,
  positionFromCells,
} from "../../src/service-allocation-automation.js"
import { type SeatLayoutCell, seatLayoutSpecSchema } from "../../src/validation.js"

describe("positionFromCells", () => {
  it("marks the outer seats of a 2-2 row as window and the inner ones as aisle", () => {
    const cells: SeatLayoutCell[] = ["seat", "seat", "aisle", "seat", "seat"]
    expect(positionFromCells(cells, 0)).toBe("window")
    expect(positionFromCells(cells, 1)).toBe("aisle")
    expect(positionFromCells(cells, 3)).toBe("aisle")
    expect(positionFromCells(cells, 4)).toBe("window")
  })

  it("classifies a 3-2 row's middle seat as middle", () => {
    const cells: SeatLayoutCell[] = ["seat", "seat", "seat", "aisle", "seat", "seat"]
    expect(positionFromCells(cells, 0)).toBe("window")
    expect(positionFromCells(cells, 1)).toBe("middle")
    expect(positionFromCells(cells, 2)).toBe("aisle")
    expect(positionFromCells(cells, 4)).toBe("aisle")
    expect(positionFromCells(cells, 5)).toBe("window")
  })

  it("treats a door cell the same as an aisle for neighbouring seats", () => {
    const cells: SeatLayoutCell[] = ["seat", "seat", "door", "seat", "seat"]
    expect(positionFromCells(cells, 1)).toBe("aisle")
    expect(positionFromCells(cells, 3)).toBe("aisle")
  })

  it("treats a void cell as a row edge — neighbour becomes window", () => {
    const cells: SeatLayoutCell[] = ["void", "void", "aisle", "seat", "seat"]
    expect(positionFromCells(cells, 3)).toBe("aisle")
    expect(positionFromCells(cells, 4)).toBe("window")
  })
})

describe("parseLayoutSpecFromFlags", () => {
  it("returns null when flags is null or missing layoutSpec", () => {
    expect(parseLayoutSpecFromFlags(null)).toBeNull()
    expect(parseLayoutSpecFromFlags({})).toBeNull()
    expect(parseLayoutSpecFromFlags({ unrelated: 1 })).toBeNull()
  })

  it("parses a valid layoutSpec out of the flags blob", () => {
    const spec = {
      rows: [
        { cells: ["seat", "seat", "aisle", "seat", "seat"] },
        { cells: ["door", "door", "door", "door", "door"] },
        { cells: ["seat", "seat", "aisle", "seat", "seat"] },
      ],
    }
    const parsed = parseLayoutSpecFromFlags({ layoutSpec: spec })
    expect(parsed).not.toBeNull()
    expect(parsed?.rows).toHaveLength(3)
    expect(parsed?.rows[1]?.cells.every((cell) => cell === "door")).toBe(true)
  })

  it("returns null when layoutSpec fails validation (unknown cell kind)", () => {
    const parsed = parseLayoutSpecFromFlags({
      layoutSpec: { rows: [{ cells: ["seat", "couch"] }] },
    })
    expect(parsed).toBeNull()
  })
})

describe("seatLayoutSpecSchema", () => {
  it("requires at least one row with at least one cell", () => {
    expect(seatLayoutSpecSchema.safeParse({ rows: [] }).success).toBe(false)
    expect(seatLayoutSpecSchema.safeParse({ rows: [{ cells: [] }] }).success).toBe(false)
  })

  it("caps rows and cells per row to keep DB writes bounded", () => {
    const wideRow = { cells: new Array(21).fill("seat") }
    expect(seatLayoutSpecSchema.safeParse({ rows: [wideRow] }).success).toBe(false)
    const tallSpec = { rows: new Array(41).fill({ cells: ["seat"] }) }
    expect(seatLayoutSpecSchema.safeParse(tallSpec).success).toBe(false)
  })
})
