import { describe, expect, it } from "vitest"

import {
  localToInstant,
  slotEndDateLocal,
  slotLocalEnd,
  slotLocalStart,
} from "../../../src/availability/slot-timezone.js"

describe("slot timezone helpers", () => {
  const bucharestMidnightSlot = {
    startsAt: "2026-09-25T21:00:00Z",
    endsAt: "2026-09-26T21:00:00Z",
    timezone: "Europe/Bucharest",
  }

  it("derives slot-local start and end dates from the slot timezone", () => {
    expect(slotLocalStart(bucharestMidnightSlot)).toEqual({
      date: "2026-09-26",
      time: "00:00",
    })
    expect(slotLocalEnd(bucharestMidnightSlot)).toEqual({
      date: "2026-09-27",
      time: "00:00",
    })
    expect(slotEndDateLocal(bucharestMidnightSlot)).toBe("2026-09-27")
  })

  it("converts local date and time in an IANA timezone to a UTC instant", () => {
    expect(
      localToInstant({
        date: "2026-09-26",
        time: "00:00",
        timezone: "Europe/Bucharest",
      }),
    ).toBe("2026-09-25T21:00:00.000Z")
  })
})
