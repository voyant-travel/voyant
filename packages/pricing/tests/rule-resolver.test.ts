import { describe, expect, it } from "vitest"

import {
  pickRulesForDate,
  type ResolverRuleInput,
  type ResolverScheduleInput,
} from "../src/service-rule-resolver.js"

const rule = (id: string, overrides: Partial<ResolverRuleInput> = {}): ResolverRuleInput => ({
  id,
  name: id,
  isDefault: false,
  priceScheduleId: null,
  ...overrides,
})

const schedule = (
  id: string,
  overrides: Partial<ResolverScheduleInput> = {},
): ResolverScheduleInput => ({
  id,
  active: true,
  priority: 0,
  recurrenceRule: "FREQ=DAILY",
  validFrom: null,
  validTo: null,
  weekdays: null,
  timezone: null,
  ...overrides,
})

const map = (...schedules: ResolverScheduleInput[]) => new Map(schedules.map((s) => [s.id, s]))

describe("pickRulesForDate", () => {
  it("returns the default rule when only a default exists and no date is constrained", () => {
    const def = rule("default", { isDefault: true })
    const result = pickRulesForDate([def], map(), "2026-07-15")
    expect(result).toEqual([def])
  })

  it("returns empty when no rule matches and no fallback exists", () => {
    const seasonal = rule("seasonal", { priceScheduleId: "s1" })
    const result = pickRulesForDate(
      [seasonal],
      map(schedule("s1", { validFrom: "2026-06-01", validTo: "2026-08-31" })),
      "2026-09-15",
    )
    expect(result).toEqual([])
  })

  it("seasonal rule wins over default when date is in window", () => {
    const def = rule("default", { isDefault: true })
    const seasonal = rule("seasonal", { priceScheduleId: "s1" })
    const result = pickRulesForDate(
      [def, seasonal],
      map(schedule("s1", { validFrom: "2026-06-01", validTo: "2026-08-31" })),
      "2026-07-15",
    )
    expect(result).toEqual([seasonal])
  })

  it("default rule wins when seasonal window doesn't match", () => {
    const def = rule("default", { isDefault: true })
    const seasonal = rule("seasonal", { priceScheduleId: "s1" })
    const result = pickRulesForDate(
      [def, seasonal],
      map(schedule("s1", { validFrom: "2026-06-01", validTo: "2026-08-31" })),
      "2026-12-15",
    )
    expect(result).toEqual([def])
  })

  it("higher-priority schedule wins among overlapping windows", () => {
    const summer = rule("summer", { priceScheduleId: "s1" })
    const holiday = rule("holiday", { priceScheduleId: "s2" })
    const result = pickRulesForDate(
      [summer, holiday],
      map(
        schedule("s1", { priority: 0, validFrom: "2026-06-01", validTo: "2026-08-31" }),
        schedule("s2", { priority: 100, validFrom: "2026-08-15", validTo: "2026-08-20" }),
      ),
      "2026-08-17",
    )
    expect(result).toEqual([holiday])
  })

  it("RRULE BYDAY matches the right weekday", () => {
    const weekend = rule("weekend", { priceScheduleId: "s1" })
    const insideWeekend = pickRulesForDate(
      [weekend],
      map(
        schedule("s1", {
          recurrenceRule: "FREQ=WEEKLY;BYDAY=SA,SU",
          validFrom: "2026-01-01",
        }),
      ),
      "2026-07-18",
    )
    expect(insideWeekend).toEqual([weekend])

    const outsideWeekend = pickRulesForDate(
      [weekend],
      map(
        schedule("s1", {
          recurrenceRule: "FREQ=WEEKLY;BYDAY=SA,SU",
          validFrom: "2026-01-01",
        }),
      ),
      "2026-07-15",
    )
    expect(outsideWeekend).toEqual([])
  })

  it("weekdays array filters dates", () => {
    const weekend = rule("weekend", { priceScheduleId: "s1" })
    const sched = schedule("s1", {
      validFrom: "2026-01-01",
      weekdays: ["SA", "SU"],
    })
    expect(pickRulesForDate([weekend], map(sched), "2026-07-18")).toEqual([weekend])
    expect(pickRulesForDate([weekend], map(sched), "2026-07-15")).toEqual([])
  })

  it("single-day window (validFrom == validTo) supports per-departure override", () => {
    const def = rule("default", { isDefault: true })
    const oneOff = rule("oneOff", { priceScheduleId: "s1" })
    const sched = schedule("s1", {
      priority: 50,
      validFrom: "2026-06-21",
      validTo: "2026-06-21",
    })
    expect(pickRulesForDate([def, oneOff], map(sched), "2026-06-21")).toEqual([oneOff])
    expect(pickRulesForDate([def, oneOff], map(sched), "2026-06-22")).toEqual([def])
  })

  it("inactive schedule is treated as no match", () => {
    const def = rule("default", { isDefault: true })
    const seasonal = rule("seasonal", { priceScheduleId: "s1" })
    const result = pickRulesForDate(
      [def, seasonal],
      map(
        schedule("s1", {
          active: false,
          validFrom: "2026-06-01",
          validTo: "2026-08-31",
        }),
      ),
      "2026-07-15",
    )
    expect(result).toEqual([def])
  })

  it("dangling priceScheduleId (schedule missing from map) skips the rule", () => {
    const def = rule("default", { isDefault: true })
    const dangling = rule("dangling", { priceScheduleId: "missing" })
    const result = pickRulesForDate([def, dangling], map(), "2026-07-15")
    expect(result).toEqual([def])
  })

  it("rule without schedule and not default is skipped (only default-or-scheduled rules participate)", () => {
    const orphan = rule("orphan")
    const result = pickRulesForDate([orphan], map(), "2026-07-15")
    expect(result).toEqual([])
  })

  it("ties on priority break by isDefault then name", () => {
    const a = rule("alpha", { priceScheduleId: "s1" })
    const b = rule("beta", { priceScheduleId: "s2", isDefault: true })
    const result = pickRulesForDate(
      [a, b],
      map(
        schedule("s1", { priority: 10, validFrom: "2026-01-01" }),
        schedule("s2", { priority: 10, validFrom: "2026-01-01" }),
      ),
      "2026-07-15",
    )
    expect(result).toEqual([b])
  })
})
