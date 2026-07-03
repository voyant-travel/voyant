import { describe, expect, it } from "vitest"
import { promotionsUiEn } from "./i18n/en.js"
import { PromotionsApiError } from "./index.js"
import { formatPromotionActionError } from "./promotions-page-actions.js"

describe("promotion page actions", () => {
  it("maps delete conflicts to archive-instead guidance", () => {
    const error = new PromotionsApiError(
      "cannot delete offer pofr_1: 1 redemption(s) exist; archive instead",
      409,
      { error: "conflict" },
    )

    expect(formatPromotionActionError(error, "Delete", promotionsUiEn.promotionsPage)).toBe(
      promotionsUiEn.promotionsPage.actions.deleteConflict,
    )
  })

  it("keeps non-conflict API errors actionable", () => {
    const error = new PromotionsApiError("Promotional offer not found", 404, {
      error: "not found",
    })

    expect(formatPromotionActionError(error, "Archive", promotionsUiEn.promotionsPage)).toBe(
      "Archive failed: Promotional offer not found",
    )
  })

  it("keeps non-delete conflicts tied to the attempted action", () => {
    const error = new PromotionsApiError("Active promotional offer code already exists", 409, {
      error: "conflict",
    })

    expect(formatPromotionActionError(error, "Activate", promotionsUiEn.promotionsPage)).toBe(
      "Activate failed: Active promotional offer code already exists",
    )
  })
})
