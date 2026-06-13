import { describe, expect, it } from "vitest"

import {
  getRoomArrangementOptionNames,
  optionLooksLikeRoomArrangementLabel,
} from "./components/product-options-section.js"

describe("product option configuration warnings", () => {
  it("detects room arrangements configured as separate options", () => {
    const options = [
      { id: "opt_single", name: "Single", code: "SGL", status: "active" },
      { id: "opt_double", name: "Double", code: "DBL", status: "active" },
      { id: "opt_triple", name: "Triple", code: "TPL", status: "active" },
    ] as const
    const unitsByOptionId = new Map([
      ["opt_single", [{ unitType: "room" }]],
      ["opt_double", [{ unitType: "room" }]],
      ["opt_triple", [{ unitType: "room" }]],
    ] as const)

    expect(getRoomArrangementOptionNames(options, unitsByOptionId)).toEqual([
      "Single",
      "Double",
      "Triple",
    ])
  })

  it("does not flag a single standard option with multiple room units", () => {
    const options = [
      { id: "opt_standard", name: "Standard", code: "STD", status: "active" },
    ] as const
    const unitsByOptionId = new Map([
      ["opt_standard", [{ unitType: "room" }, { unitType: "room" }, { unitType: "room" }]],
    ] as const)

    expect(getRoomArrangementOptionNames(options, unitsByOptionId)).toEqual([])
  })

  it("ignores room labels when the option is not room-only", () => {
    const options = [
      { id: "opt_double", name: "Double", code: "DBL", status: "active" },
      { id: "opt_single", name: "Single", code: "SGL", status: "active" },
    ] as const
    const unitsByOptionId = new Map([
      ["opt_double", [{ unitType: "room" }, { unitType: "person" }]],
      ["opt_single", [{ unitType: "room" }]],
    ] as const)

    expect(getRoomArrangementOptionNames(options, unitsByOptionId)).toEqual(["Single"])
  })

  it("recognizes common room arrangement labels and codes", () => {
    expect(optionLooksLikeRoomArrangementLabel({ name: "Camera dubla", code: "DBL" })).toBe(true)
    expect(optionLooksLikeRoomArrangementLabel({ name: "Standard", code: "STD" })).toBe(false)
  })
})
