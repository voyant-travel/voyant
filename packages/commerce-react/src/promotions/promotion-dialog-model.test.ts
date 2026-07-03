import { describe, expect, it } from "vitest"
import { promotionsUiEn } from "./i18n/en.js"
import {
  buildPromotionPayload,
  emptyPromotionForm,
  parseScopeIds,
  scopeIdsToFormValue,
} from "./promotion-dialog-model.js"

const messages = promotionsUiEn.promotionDialog

describe("promotion dialog model", () => {
  it("builds a product-scoped payload from selected product ids", () => {
    const state = {
      ...emptyPromotionForm(),
      name: "Spring Sale",
      slug: "spring-sale",
      discountPercent: "15",
      scopeKind: "products" as const,
      scopeIds: scopeIdsToFormValue(["prod_1", "prod_2", "prod_1"]),
    }

    const payload = buildPromotionPayload(state, messages, "Products")

    expect(payload).toMatchObject({
      name: "Spring Sale",
      slug: "spring-sale",
      discountType: "percentage",
      discountPercent: 15,
      scope: { kind: "products", productIds: ["prod_1", "prod_2"] },
      active: true,
    })
  })

  it("returns field-specific validation errors for slug, code, dates, and empty scopes", () => {
    const base = {
      ...emptyPromotionForm(),
      name: "Sale",
      slug: "sale",
      discountPercent: "10",
    }

    expect(buildPromotionPayload({ ...base, slug: "Bad Slug" }, messages, "Global")).toEqual({
      error: messages.validation.slugInvalid,
    })
    expect(buildPromotionPayload({ ...base, code: "BAD CODE" }, messages, "Global")).toEqual({
      error: messages.validation.codeInvalid,
    })
    expect(
      buildPromotionPayload(
        { ...base, validFrom: "2026-07-10T00:00", validUntil: "2026-07-09T00:00" },
        messages,
        "Global",
      ),
    ).toEqual({ error: messages.validation.validRangeInvalid })
    expect(
      buildPromotionPayload({ ...base, scopeKind: "products", scopeIds: "" }, messages, "Products"),
    ).toEqual({ error: "Products: add at least one value." })
  })

  it("normalizes typed scope references", () => {
    expect(parseScopeIds(" prod_1, prod_2\nprod_3 ")).toEqual(["prod_1", "prod_2", "prod_3"])
    expect(scopeIdsToFormValue(["prod_1", "prod_2", "prod_1", ""])).toBe("prod_1, prod_2")
  })
})
