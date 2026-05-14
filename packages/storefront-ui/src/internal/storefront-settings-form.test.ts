import { describe, expect, it } from "vitest"

import { emptyForm, toPayload, validateForm } from "./storefront-settings-form.js"

describe("storefront settings form helpers", () => {
  it("rejects unsupported URL protocols", () => {
    expect(validateForm({ ...emptyForm, logoUrl: "ftp://example.com/logo.svg" })).toBe(
      "URLs must be valid http or https links.",
    )
  })

  it("requires the default payment method to be enabled", () => {
    expect(validateForm({ ...emptyForm, defaultMethod: "card" })).toBe(
      "The default payment method must be enabled.",
    )
  })

  it("serializes support links, payment methods, and bank details", () => {
    expect(
      toPayload({
        ...emptyForm,
        supportEmail: " support@example.com ",
        supportLinks: [{ rowKey: "support-link-1", label: " Help ", url: " https://help.test " }],
        defaultMethod: "bank_transfer",
        enabledMethods: { ...emptyForm.enabledMethods, bank_transfer: true },
        depositPercent: "30",
        balanceDueDaysBeforeDeparture: "45",
        iban: "RO49AAAA1B31007593840000",
      }),
    ).toMatchObject({
      support: {
        email: "support@example.com",
        links: [{ label: "Help", url: "https://help.test" }],
      },
      payment: {
        defaultMethod: "bank_transfer",
        methods: [{ code: "bank_transfer" }],
        defaultSchedule: {
          depositPercent: 30,
          balanceDueDaysBeforeDeparture: 45,
        },
        bankTransfer: {
          iban: "RO49AAAA1B31007593840000",
        },
      },
    })
  })
})
