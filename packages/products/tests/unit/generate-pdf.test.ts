import { describe, expect, it } from "vitest"

import { plainTextForPdf } from "../../src/tasks/pdf-text.js"

describe("plainTextForPdf", () => {
  it("strips rich text editor markup before PDF rendering", () => {
    expect(
      plainTextForPdf(
        '<p>Arrive &amp; check in</p><ul><li><a href="https://example.com">Hotel</a></li><li>Walk</li></ul>',
      ),
    ).toBe("Arrive & check in * Hotel * Walk")
  })

  it("preserves non-HTML plain text", () => {
    expect(plainTextForPdf("Keep 2 < 3 and 5 > 4")).toBe("Keep 2 < 3 and 5 > 4")
  })
})
