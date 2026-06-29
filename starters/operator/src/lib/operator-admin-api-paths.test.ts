import { describe, expect, it } from "vitest"
import { normalizeOperatorAdminApiUrl } from "./operator-admin-api-paths"

describe("normalizeOperatorAdminApiUrl", () => {
  it.each([
    ["/api/v1/relationships/people?limit=25", "/api/v1/admin/relationships/people?limit=25"],
    ["/api/v1/operations/resources", "/api/v1/admin/operations/resources"],
    ["/api/v1/products", "/api/v1/admin/products"],
    ["/api/v1/markets/markets#active", "/api/v1/admin/markets/markets#active"],
    ["/v1/relationships/organizations", "/v1/admin/relationships/organizations"],
    ["/v1/operations/availability/slots", "/v1/admin/operations/availability/slots"],
  ])("rewrites package admin paths from %s to %s", (input, expected) => {
    expect(normalizeOperatorAdminApiUrl(input)).toBe(expected)
  })

  it("rewrites absolute URLs without changing the origin", () => {
    expect(
      normalizeOperatorAdminApiUrl(
        "https://operator.example.com/api/v1/relationships/people?limit=20",
      ),
    ).toBe("https://operator.example.com/api/v1/admin/relationships/people?limit=20")
  })

  it.each([
    "/api/v1/admin/relationships/people",
    "/api/v1/public/payment-link-config",
    "/api/auth/me",
    "/api/v1/media/uploads/photo.png",
    "v1/relationships/people",
  ])("leaves non-matching or already-admin URLs unchanged: %s", (input) => {
    expect(normalizeOperatorAdminApiUrl(input)).toBe(input)
  })
})
