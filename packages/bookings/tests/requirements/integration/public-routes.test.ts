import { describe, expect, it } from "vitest"

import { createBookingRequirementsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Public booking requirement routes", () => {
  const ctx = createBookingRequirementsTestContext()

  it("summarizes product transport document requirements", async () => {
    const createRequirement = (body: Record<string, unknown>) =>
      ctx.request("/contact-requirements", {
        method: "POST",
        ...json({ productId: ctx.productId(), ...body }),
      })

    await createRequirement({
      fieldKey: "passport_number",
      scope: "traveler",
      isRequired: true,
    })
    await createRequirement({
      fieldKey: "passport_expiry",
      scope: "traveler",
      isRequired: true,
    })
    await createRequirement({
      fieldKey: "nationality",
      scope: "lead_traveler",
      isRequired: true,
    })
    await createRequirement({
      fieldKey: "email",
      scope: "booker",
      isRequired: true,
    })

    const res = await ctx.publicRequest(`/products/${ctx.productId()}/transport-requirements`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.productId).toBe(ctx.productId())
    expect(body.data.hasTransport).toBe(false)
    expect(body.data.requiresPassport).toBe(true)
    expect(body.data.requiresPassengerDocuments).toBe(true)
    expect(body.data.requiredFields).toEqual(["nationality", "passport_expiry", "passport_number"])
    expect(body.data.fieldsByScope.traveler).toEqual(["passport_expiry", "passport_number"])
    expect(body.data.fieldsByScope.lead_traveler).toEqual(["nationality"])
    expect(body.data.requirements).toHaveLength(3)
  })

  it("includes option-specific transport requirements when an option is requested", async () => {
    await ctx.request("/contact-requirements", {
      method: "POST",
      ...json({
        productId: ctx.productId(),
        fieldKey: "date_of_birth",
        scope: "traveler",
        isRequired: true,
      }),
    })
    await ctx.request("/contact-requirements", {
      method: "POST",
      ...json({
        productId: ctx.productId(),
        optionId: ctx.optionId(),
        fieldKey: "passport_number",
        scope: "traveler",
        isRequired: true,
      }),
    })

    const res = await ctx.publicRequest(
      `/products/${ctx.productId()}/transport-requirements?optionId=${ctx.optionId()}`,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.optionId).toBe(ctx.optionId())
    expect(body.data.requiredFields).toEqual(["date_of_birth", "passport_number"])
    expect(body.data.requiresDateOfBirth).toBe(true)
    expect(body.data.requiresPassport).toBe(true)
  })
})
