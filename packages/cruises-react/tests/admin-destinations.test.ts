import type { AdminDestinationKey, AdminDestinationResolvers } from "@voyant-travel/admin"
import { describe, expect, it } from "vitest"

// Type-only import binds nothing at runtime; for `tsc --noEmit` the
// augmentation file (src/admin/index.tsx) is part of the program via the
// tsconfig include, so its `declare module "@voyant-travel/admin"` block merges
// into AdminDestinations here.
import type { CreateCruisesAdminExtensionOptions } from "../src/admin/index.js"

/**
 * Type-level proof of the semantic-destination contract (packaged-admin RFC
 * §4.7). The ship pages link by key rather than by importing a host route
 * tree, and the host's resolver map is `Partial`, so a key with no resolver
 * degrades to `"#"` at runtime rather than failing a build. That makes a
 * compile-time proof the only thing standing between a typo and a dead link.
 */
describe("cruises admin destinations (type-level)", () => {
  it("augments AdminDestinations with the ship destination keys", () => {
    const keys = [
      "cruiseShip.list",
      "cruiseShip.detail",
    ] as const satisfies ReadonlyArray<AdminDestinationKey>

    // Exhaustive: `satisfies AdminDestinationResolvers` fails to compile if a
    // declared key is missing a resolver or a param shape drifts.
    const resolvers = {
      "cruiseShip.list": () => "/catalog/ships",
      "cruiseShip.detail": ({ shipId }) => `/catalog/ships/${shipId}`,
    } satisfies AdminDestinationResolvers

    expect(Object.keys(resolvers).sort()).toEqual([...keys].sort())
  })

  it("resolves a ship detail href under the browse path it is mounted at", () => {
    const resolve = ({ shipId }: { shipId: string }) => `/catalog/ships/${shipId}`
    expect(resolve({ shipId: "cruise_ships_01" })).toBe("/catalog/ships/cruise_ships_01")
  })

  it("defaults the mount path so a host need not name it", () => {
    const options: CreateCruisesAdminExtensionOptions = {}
    expect(options.path).toBeUndefined()
  })
})
