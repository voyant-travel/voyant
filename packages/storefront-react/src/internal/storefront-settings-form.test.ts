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
        paymentStructure: "split",
        depositPercent: "30",
        balanceDueDaysBeforeDeparture: "45",
        bankTransferDueDays: "7",
        bankProvider: "bt",
        bankCurrency: "RON",
        accountHolder: "Voyant Travel SRL",
        bankName: "Banca Transilvania",
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
        structure: "split",
        schedule: [
          { percent: 30, dueInDays: 0, dueCondition: "after_booking" },
          { percent: 70, dueInDays: 45, dueCondition: "before_departure" },
        ],
        defaultSchedule: {
          depositPercent: 30,
          balanceDueDaysBeforeDeparture: 45,
        },
        bankTransfer: {
          dueDays: 7,
          account: {
            provider: "bt",
            currency: "RON",
            iban: "RO49AAAA1B31007593840000",
            beneficiary: "Voyant Travel SRL",
            bank: "Banca Transilvania",
          },
          accountHolder: "Voyant Travel SRL",
          bankName: "Banca Transilvania",
          iban: "RO49AAAA1B31007593840000",
        },
      },
    })
  })
})
