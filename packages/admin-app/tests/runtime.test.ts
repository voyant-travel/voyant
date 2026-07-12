import { describe, expect, it } from "vitest"
import { getAdminApiUrl, normalizeAdminApiUrl } from "../src/runtime.js"

describe("normalizeAdminApiUrl", () => {
  it.each([
    ["/api/v1/relationships/people?limit=25", "/api/v1/admin/relationships/people?limit=25"],
    ["/api/v1/operations/resources", "/api/v1/admin/operations/resources"],
    ["/api/v1/products", "/api/v1/admin/products"],
    ["/api/v1/markets/markets#active", "/api/v1/admin/markets/markets#active"],
    ["/api/v1/bookings?limit=25&offset=0", "/api/v1/admin/bookings?limit=25&offset=0"],
    ["/api/v1/suppliers?limit=25&offset=0", "/api/v1/admin/suppliers?limit=25&offset=0"],
    ["/v1/relationships/organizations", "/v1/admin/relationships/organizations"],
    ["/v1/operations/availability/slots", "/v1/admin/operations/availability/slots"],
    ["/v1/bookings/bkg_123", "/v1/admin/bookings/bkg_123"],
    ["/v1/suppliers/sup_123", "/v1/admin/suppliers/sup_123"],
  ])("rewrites package admin paths from %s to %s", (input, expected) => {
    expect(normalizeAdminApiUrl(input)).toBe(expected)
  })

  it("rewrites absolute URLs without changing the origin", () => {
    expect(
      normalizeAdminApiUrl("https://operator.example.com/api/v1/relationships/people?limit=20"),
    ).toBe("https://operator.example.com/api/v1/admin/relationships/people?limit=20")
  })

  it.each([
    "/api/v1/admin/relationships/people",
    "/api/v1/public/payment-link-config",
    "/api/auth/me",
    "/api/v1/media/uploads/photo.png",
    "v1/relationships/people",
  ])("leaves non-matching or already-admin URLs unchanged: %s", (input) => {
    expect(normalizeAdminApiUrl(input)).toBe(input)
  })
})

describe("getAdminApiUrl", () => {
  it("returns an /api-suffixed absolute URL on the server", () => {
    const url = getAdminApiUrl()
    expect(url).toMatch(/^https?:\/\/.+\/api$/)
  })
})
