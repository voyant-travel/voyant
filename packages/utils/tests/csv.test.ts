import { describe, expect, it } from "vitest"

import { toCsvCell, toCsvRow } from "../src/csv.js"

describe("toCsvCell", () => {
  it("returns empty string for null and undefined", () => {
    expect(toCsvCell(null)).toBe("")
    expect(toCsvCell(undefined)).toBe("")
  })

  it("passes plain values through unchanged", () => {
    expect(toCsvCell("Alice")).toBe("Alice")
    expect(toCsvCell("hello world")).toBe("hello world")
    expect(toCsvCell(42)).toBe("42")
    expect(toCsvCell(true)).toBe("true")
  })

  it("quotes values containing commas", () => {
    expect(toCsvCell("Doe, Jane")).toBe('"Doe, Jane"')
  })

  it("quotes values containing double quotes and doubles them", () => {
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it("quotes values containing newlines and carriage returns", () => {
    expect(toCsvCell("line1\nline2")).toBe('"line1\nline2"')
    expect(toCsvCell("a\r\nb")).toBe(`"a\r\nb"`)
  })

  it.each([
    "=",
    "+",
    "-",
    "@",
    "\t",
  ])("neutralizes formula prefix %j with a leading single quote", (prefix) => {
    const out = toCsvCell(`${prefix}payload`)
    expect(out.replace(/^"/, "").startsWith("'")).toBe(true)
  })

  it("neutralizes a leading carriage return", () => {
    expect(toCsvCell("\rfoo")).toBe(`"'\rfoo"`)
  })

  it("neutralizes classic Excel injection payloads", () => {
    expect(toCsvCell('=HYPERLINK("http://evil.test","click")')).toBe(
      `"'=HYPERLINK(""http://evil.test"",""click"")"`,
    )
    expect(toCsvCell("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1")
    expect(toCsvCell("@SUM(1+9)*cmd|'/c calc'!A0")).toBe("'@SUM(1+9)*cmd|'/c calc'!A0")
    expect(toCsvCell("+1234567")).toBe("'+1234567")
    expect(toCsvCell("-2+3")).toBe("'-2+3")
  })

  it("does not neutralize formula characters mid-value", () => {
    expect(toCsvCell("a=b")).toBe("a=b")
    expect(toCsvCell("1 + 1")).toBe("1 + 1")
  })

  it("neutralizes negative numbers passed as numbers (documented tradeoff)", () => {
    // A leading "-" is also a formula trigger in Excel; the export consumer
    // is expected to treat the cell as text.
    expect(toCsvCell(-5)).toBe("'-5")
  })
})

describe("toCsvRow", () => {
  it("joins encoded cells with commas", () => {
    expect(toCsvRow(["a", "b,c", null, "=evil()"])).toBe(`a,"b,c",,'=evil()`)
  })

  it("round-trips a header row untouched", () => {
    const headers = ["id", "firstName", "lastName", "email"]
    expect(toCsvRow(headers)).toBe("id,firstName,lastName,email")
  })
})
