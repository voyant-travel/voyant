import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { defaultMinimalShape } from "../../src/journey/components/booking-journey-rules.js"
import { TravelersStep } from "../../src/journey/components/journey-steps/travelers-step.js"
import { emptyDraft, setTravelers } from "../../src/journey/lib/draft-state.js"

const ENTITY = {
  module: "products",
  id: "prod_1",
  sourceKind: "owned",
} as const

describe("booking journey party state", () => {
  it("labels the traveler row action as adding another required traveler", () => {
    const draft = setTravelers(emptyDraft(ENTITY), [
      {
        rowId: "row_1",
        firstName: "Ana",
        lastName: "Pop",
        band: "adult",
      },
    ])

    const html = renderToStaticMarkup(
      <TravelersStep draft={draft} setDraft={vi.fn()} shape={defaultMinimalShape()} />,
    )

    expect(html).toContain("Add another traveler")
  })
})
