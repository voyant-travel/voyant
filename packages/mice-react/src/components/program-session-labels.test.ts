import { describe, expect, it } from "vitest"

import { formatSessionTimeLabel } from "./program-session-labels.js"

describe("formatSessionTimeLabel", () => {
  it("renders an em dash when a session has no start time", () => {
    expect(formatSessionTimeLabel(null)).toBe("—")
    expect(formatSessionTimeLabel(undefined)).toBe("—")
    expect(formatSessionTimeLabel("")).toBe("—")
  })

  it("renders the time from an ISO datetime", () => {
    expect(formatSessionTimeLabel("2026-10-11T09:30:00.000Z")).toBe("09:30")
    expect(formatSessionTimeLabel("2026-10-11T14:05:00+02:00")).toBe("14:05")
  })

  it("renders a time-only value", () => {
    expect(formatSessionTimeLabel("08:15")).toBe("08:15")
    expect(formatSessionTimeLabel("16:45:00")).toBe("16:45")
  })

  it("does not render a date-only value as a time", () => {
    expect(formatSessionTimeLabel("2026-10-11")).toBe("—")
  })
})
