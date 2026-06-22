import { describe, expect, it } from "vitest"

import { matchesPublicPath, normalizePathname } from "../../src/lib/public-paths.js"

describe("public path normalization", () => {
  it("strips a configured deployment base path before matching", () => {
    const pathname = normalizePathname("/api/v1/public/media/image.jpg", { basePath: "/api" })

    expect(pathname).toBe("/v1/public/media/image.jpg")
    expect(matchesPublicPath(pathname, ["/v1/public/media"])).toBe(true)
  })

  it("does not strip similar non-segment prefixes", () => {
    const pathname = normalizePathname("/apiary/v1/public/media/image.jpg", { basePath: "/api" })

    expect(pathname).toBe("/apiary/v1/public/media/image.jpg")
    expect(matchesPublicPath(pathname, ["/v1/public/media"])).toBe(false)
  })

  it("keeps existing exact and segment-prefix public path semantics", () => {
    expect(matchesPublicPath("/v1/media", ["/v1/media"])).toBe(true)
    expect(matchesPublicPath("/v1/media/product.jpg", ["/v1/media"])).toBe(true)
    expect(matchesPublicPath("/v1/medialibrary/product.jpg", ["/v1/media"])).toBe(false)
  })
})
