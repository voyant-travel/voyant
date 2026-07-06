import { describe, expect, it } from "vitest"

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

    const text = stepHeadline("departure", draft, messages)

    expect(text).toContain(" → ")
    expect(text).not.toContain("2026-07-06")
    expect(text).not.toContain("2026-07-09")
  })
})
