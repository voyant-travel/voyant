import { describe, expect, it } from "vitest"

import {
  defaultOperatorNavIcons,
  type OperatorAdminNavigationIconName,
} from "../../src/navigation/operator-navigation.js"

const EXPECTED_NAMES: OperatorAdminNavigationIconName[] = [
  "availability",
  "bookings",
  "catalog",
  "channelSync",
  "dashboard",
  "finance",
  "flights",
  "legal",
  "notifications",
  "organizations",
  "people",
  "products",
  "resources",
  "settings",
  "suppliers",
]

describe("defaultOperatorNavIcons", () => {
  it("ships a component for every standard nav icon name", () => {
    expect(Object.keys(defaultOperatorNavIcons).sort()).toEqual([...EXPECTED_NAMES].sort())
    for (const name of EXPECTED_NAMES) {
      // lucide icons are React components (function/forwardRef objects)
      expect(defaultOperatorNavIcons[name]).toBeDefined()
      const icon = defaultOperatorNavIcons[name]
      expect(typeof icon === "function" || typeof icon === "object").toBe(true)
    }
  })

  it("supports single-entry override via spread without losing the rest", () => {
    const Custom = () => null
    const overridden = { ...defaultOperatorNavIcons, finance: Custom }
    expect(overridden.finance).toBe(Custom)
    expect(overridden.bookings).toBe(defaultOperatorNavIcons.bookings)
  })
})
