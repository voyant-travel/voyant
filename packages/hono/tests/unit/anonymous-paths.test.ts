import { describe, expect, it } from "vitest"

import { assembleAnonymousPaths } from "../../src/anonymous-paths.js"
import type { HonoExtension, HonoModule } from "../../src/module.js"

const mod = (name: string, extra: Partial<HonoModule> = {}): HonoModule => ({
  module: { name },
  ...extra,
})
const ext = (module: string, extra: Partial<HonoExtension> = {}): HonoExtension => ({
  extension: { name: module, module },
  ...extra,
})

describe("assembleAnonymousPaths (ADR-0008)", () => {
  it("returns only explicit paths when nothing declares anonymous", () => {
    const paths = assembleAnonymousPaths(
      [mod("bookings"), mod("catalog")],
      [],
      ["/v1/finance/providers/netopia/callback"],
    )
    expect(paths).toEqual(["/v1/finance/providers/netopia/callback"])
  })

  it("opens the whole public mount for `anonymous: true`", () => {
    const paths = assembleAnonymousPaths([mod("catalog", { anonymous: true })], [])
    expect(paths).toEqual(["/v1/public/catalog"])
  })

  it("opens specific sub-paths for a string array, relative to the mount", () => {
    const paths = assembleAnonymousPaths(
      [mod("finance", { anonymous: ["/bookings", "collections", "/payment-sessions"] })],
      [],
    )
    expect(paths).toEqual([
      "/v1/public/finance/bookings",
      "/v1/public/finance/collections",
      "/v1/public/finance/payment-sessions",
    ])
  })

  it("honors a `publicPath` override when computing the mount", () => {
    const paths = assembleAnonymousPaths(
      [mod("quote-versions", { publicPath: "proposals", anonymous: true })],
      [],
    )
    expect(paths).toEqual(["/v1/public/proposals"])
  })

  it("treats `publicPath: '/' ` as the public root", () => {
    const paths = assembleAnonymousPaths(
      [mod("storefront", { publicPath: "/", anonymous: ["/leads"] })],
      [],
    )
    expect(paths).toEqual(["/v1/public/leads"])
  })

  it("assembles from extensions too (mount = extension.module)", () => {
    const paths = assembleAnonymousPaths([], [ext("catalog", { anonymous: ["/checkout"] })])
    expect(paths).toEqual(["/v1/public/catalog/checkout"])
  })

  it("unions module declarations with the explicit escape-hatch list, sorted + deduped", () => {
    const paths = assembleAnonymousPaths(
      [mod("catalog", { anonymous: true }), mod("bookings", { anonymous: true })],
      [ext("quote-versions", { publicPath: "proposals", anonymous: true })],
      ["/v1/finance/providers/netopia/callback", "/v1/public/catalog"], // dup of catalog
    )
    expect(paths).toEqual([
      "/v1/finance/providers/netopia/callback",
      "/v1/public/bookings",
      "/v1/public/catalog",
      "/v1/public/proposals",
    ])
  })

  it("ignores modules whose `anonymous` is unset or false", () => {
    const paths = assembleAnonymousPaths(
      [
        mod("catalog", { anonymous: true }),
        mod("admin-only"),
        mod("internal", { anonymous: false }),
      ],
      [],
    )
    expect(paths).toEqual(["/v1/public/catalog"])
  })
})
