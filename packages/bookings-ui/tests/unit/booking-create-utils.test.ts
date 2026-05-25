import { describe, expect, it } from "vitest"

import {
  getBookableDepartureSlots,
  getSelectedSharedRoomUnitId,
  itemLinesToRows,
  productMatchesPickerSearch,
  validateBillingPersonContact,
} from "../../src/components/booking-create-utils.js"
import { clearSharedRoomValue } from "../../src/components/shared-room-section.js"

describe("booking create helpers", () => {
  it("matches product picker search case-insensitively", () => {
    expect(
      productMatchesPickerSearch(
        {
          name: "City Break Istanbul cu autocarul",
          description: null,
          sellCurrency: "EUR",
        },
        "istanbul",
      ),
    ).toBe(true)
  })

  it("matches product picker search without diacritics", () => {
    expect(
      productMatchesPickerSearch(
        {
          name: "Weekend in Râșnov",
          description: null,
          sellCurrency: "EUR",
        },
        "rasnov",
      ),
    ).toBe(true)
  })

  it("keeps future open departures for the selected product option", () => {
    const result = getBookableDepartureSlots(
      [
        {
          id: "past-open",
          optionId: null,
          startsAt: "2026-04-18T08:00:00.000Z",
          status: "open",
        },
        {
          id: "global-open",
          optionId: null,
          startsAt: "2026-06-18T08:00:00.000Z",
          status: "open",
        },
        {
          id: "selected-option-open",
          optionId: "option_moldova",
          startsAt: "2026-10-22T08:00:00.000Z",
          status: "open",
        },
        {
          id: "other-option-open",
          optionId: "option_other",
          startsAt: "2026-11-01T08:00:00.000Z",
          status: "open",
        },
        {
          id: "closed",
          optionId: "option_moldova",
          startsAt: "2026-12-01T08:00:00.000Z",
          status: "closed",
        },
      ],
      {
        nowIso: "2026-05-16T00:00:00.000Z",
        optionId: "option_moldova",
      },
    )

    expect(result.map((slot) => slot.id)).toEqual(["global-open", "selected-option-open"])
  })

  it("clears shared-room draft state", () => {
    expect(clearSharedRoomValue()).toEqual({
      enabled: false,
      mode: "create",
      groupId: "",
      groupLabel: "",
    })
  })

  it("carries manual confirmed totals into unpriced item lines", () => {
    const result = itemLinesToRows(
      {
        optu_double: 2,
        optu_single: 1,
      },
      [
        { optionId: null, optionUnitId: "optu_double", unitName: "Double room" },
        { optionId: null, optionUnitId: "optu_single", unitName: "Single room" },
      ],
      {
        confirmedAmountCents: 10_001,
        lines: [],
      },
    )

    expect(result).toEqual([
      {
        optionId: null,
        optionUnitId: "optu_double",
        quantity: 2,
        title: "Double room",
        unitSellAmountCents: 3333,
        totalSellAmountCents: 6667,
      },
      {
        optionId: null,
        optionUnitId: "optu_single",
        quantity: 1,
        title: "Single room",
        unitSellAmountCents: 3334,
        totalSellAmountCents: 3334,
      },
    ])
  })

  it("preserves option ids on selected room unit lines", () => {
    const result = itemLinesToRows(
      {
        optu_double: 2,
        optu_single: 1,
      },
      [
        { optionId: "opto_dbl", optionUnitId: "optu_double", unitName: "DBL" },
        { optionId: "opto_sgl", optionUnitId: "optu_single", unitName: "SGL" },
      ],
      {
        confirmedAmountCents: 459_700,
        lines: [
          {
            unitId: "optu_double",
            label: "DBL",
            unitAmountCents: 139_900,
            totalAmountCents: 279_800,
          },
          {
            unitId: "optu_single",
            label: "SGL",
            unitAmountCents: 179_900,
            totalAmountCents: 179_900,
          },
        ],
      },
    )

    expect(result.map((line) => [line.optionId, line.optionUnitId, line.quantity])).toEqual([
      ["opto_dbl", "optu_double", 2],
      ["opto_sgl", "optu_single", 1],
    ])
  })

  it("uses the selected unit for new shared-room groups", () => {
    expect(
      getSelectedSharedRoomUnitId({
        product_option: 0,
        optu_double: 1,
        optu_single: 0,
      }),
    ).toBe("optu_double")
  })

  it("accepts phone-only billing person contact", () => {
    expect(validateBillingPersonContact({ email: null, phone: " +40 700 000 000 " })).toBe("valid")
  })

  it("requires either email or phone for billing person contact", () => {
    expect(validateBillingPersonContact({ email: " ", phone: " " })).toBe("missing-contact")
  })

  it("rejects malformed billing person emails when provided", () => {
    expect(validateBillingPersonContact({ email: "traveler@example.com", phone: "+40 700" })).toBe(
      "invalid-email",
    )
  })
})
