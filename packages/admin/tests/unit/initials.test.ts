import { adminChromeMessages } from "@voyant-travel/i18n"
import { describe, expect, it } from "vitest"

import { getDisplayName, getInitials } from "../../src/lib/initials.js"

describe("getInitials", () => {
  it("combines first + last initials", () => {
    expect(getInitials("Jane", "Doe")).toBe("JD")
    expect(getInitials("alice", "smith")).toBe("AS")
  })

  it("falls back to first-name prefix when only first name given", () => {
    expect(getInitials("Mihai", null)).toBe("MI")
  })

  it("falls back to last-name prefix when only last name given", () => {
    expect(getInitials(null, "Lee")).toBe("LE")
  })

  it("falls back to email-prefix initials when name is missing", () => {
    expect(getInitials(null, null, "bob@example.com")).toBe("BO")
  })

  it("returns single char if email prefix is 1 character", () => {
    expect(getInitials(null, null, "a@example.com")).toBe("A")
  })

  it("returns '?' if no name and no usable email", () => {
    expect(getInitials(null, null, null)).toBe("?")
    expect(getInitials(null, null, "")).toBe("?")
    expect(getInitials(null, null, "@example.com")).toBe("?")
  })

  it("trims whitespace from name fields", () => {
    expect(getInitials("  Jane ", " Doe ")).toBe("JD")
  })

  it("handles missing/empty strings gracefully", () => {
    expect(getInitials("", "", "")).toBe("?")
    expect(getInitials(undefined, undefined, undefined)).toBe("?")
  })
})

describe("getDisplayName", () => {
  it("prefers firstName + lastName when both set", () => {
    expect(getDisplayName({ firstName: "Jane", lastName: "Doe", email: "x@y.com" })).toBe(
      "Jane Doe",
    )
  })

  it("falls back to firstName only if lastName is null", () => {
    expect(getDisplayName({ firstName: "Jane", lastName: null, email: "x@y.com" })).toBe("Jane")
  })

  it("falls back to lastName only if firstName is null", () => {
    expect(getDisplayName({ firstName: null, lastName: "Doe", email: "x@y.com" })).toBe("Doe")
  })

  it("falls back to `name` if first/last unset", () => {
    expect(getDisplayName({ name: "Jane Doe", email: "x@y.com" })).toBe("Jane Doe")
  })

  it("falls back to email if name unset", () => {
    expect(getDisplayName({ email: "bob@example.com" })).toBe("bob@example.com")
  })

  it("uses the catalog fallback when nothing is set", () => {
    expect(getDisplayName({})).toBe(adminChromeMessages.en.unknownUser)
    expect(getDisplayName({ firstName: "", lastName: "", name: "", email: "" })).toBe(
      adminChromeMessages.en.unknownUser,
    )
  })

  it("trims whitespace", () => {
    expect(getDisplayName({ name: "  Jane  " })).toBe("Jane")
  })
})
