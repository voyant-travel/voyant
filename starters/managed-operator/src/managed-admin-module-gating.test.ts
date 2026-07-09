import type { AdminExtension } from "@voyant-travel/admin/extensions"
import { describe, expect, it } from "vitest"

import { filterManagedAdminExtensionsByModules } from "./managed-admin-module-gating"

function ext(id: string): AdminExtension {
  return { id }
}

const FULL: AdminExtension[] = [
  ext("core"),
  ext("bookings"),
  ext("catalog"),
  ext("finance"),
  ext("flights"),
  ext("mice"),
]

const ids = (extensions: readonly AdminExtension[]) => extensions.map((extension) => extension.id)

describe("filterManagedAdminExtensionsByModules (voyant#3063)", () => {
  it("keeps only extensions whose module is active, plus always-on core", () => {
    const result = filterManagedAdminExtensionsByModules(FULL, ["bookings", "catalog"])

    expect(ids(result)).toEqual(["core", "bookings", "catalog"])
  })

  it("drops mice — it has no backing module in the active set", () => {
    const result = filterManagedAdminExtensionsByModules(FULL, [
      "bookings",
      "catalog",
      "finance",
      "flights",
    ])

    expect(ids(result)).not.toContain("mice")
    expect(ids(result)).toContain("core")
  })

  it("fails open when the runtime reports no module set (undefined)", () => {
    const result = filterManagedAdminExtensionsByModules(FULL, undefined)

    expect(ids(result)).toEqual(ids(FULL))
  })

  it("keeps core even when the active set is empty", () => {
    const result = filterManagedAdminExtensionsByModules(FULL, [])

    expect(ids(result)).toEqual(["core"])
  })
})
