import { afterEach, describe, expect, it, vi } from "vitest"

import { getBookingsUiI18n } from "../../i18n/provider.js"
import { emptyDraft, patchConfigure } from "../lib/draft-state.js"
import { stepHeadline } from "./side-panel.js"

// The departure summary line used to interpolate the draft's raw YYYY-MM-DD
// check-in/check-out values (#2967). It now formats them with the locale-aware
// helper, so the summary must no longer echo the raw ISO strings.
describe("stepHeadline — departure stay range (#2967)", () => {
  it("formats the check-in/check-out range instead of showing raw ISO dates", () => {
    const messages = getBookingsUiI18n({}).messages
    const draft = patchConfigure(
      emptyDraft({ module: "accommodations", id: "acc-1", sourceKind: "" }),
      { dateRange: { checkIn: "2026-07-06", checkOut: "2026-07-09" } },
    )

    const text = stepHeadline("departure", draft, messages, "en")

    expect(text).toContain(" → ")
    expect(text).not.toContain("2026-07-06")
    expect(text).not.toContain("2026-07-09")
  })

  // Date-only strings parse as UTC midnight, so naive local-time rendering
  // shifts the calendar date back a day for viewers west of UTC.
  it("does not shift date-only values in timezones west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York")
    const messages = getBookingsUiI18n({}).messages
    const draft = patchConfigure(
      emptyDraft({ module: "accommodations", id: "acc-1", sourceKind: "" }),
      { dateRange: { checkIn: "2026-07-06", checkOut: "2026-07-09" } },
    )

    const text = stepHeadline("departure", draft, messages, "en")

    // Day numbers must stay 6 and 9, not slide to 5 and 8.
    expect(text).toMatch(/\b6\b/)
    expect(text).toMatch(/\b9\b/)
    expect(text).not.toMatch(/\b5\b/)
    expect(text).not.toMatch(/\b8\b/)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })
})
