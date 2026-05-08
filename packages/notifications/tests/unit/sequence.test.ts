import { describe, expect, it } from "vitest"

import type { NotificationReminderRule, NotificationReminderRuleStage } from "../../src/schema.js"
import {
  applyQuietHours,
  cadenceElapsed,
  DEFAULT_NOTIFICATION_SETTINGS,
  evaluateStage,
  inWindow,
  pickActiveStage,
  pickEscalatingInterval,
  type ReminderTargetSnapshot,
  resolveAnchor,
  type SequenceHistoryEntry,
} from "../../src/service-sequence.js"

const baseStage: NotificationReminderRuleStage = {
  id: "ntrs_1",
  reminderRuleId: "ntrl_1",
  orderIndex: 0,
  name: null,
  anchor: "due_date",
  windowStartDays: -7,
  windowEndDays: 0,
  cadenceKind: "once",
  cadenceEveryDays: null,
  cadenceIntervals: null,
  maxSendsInStage: null,
  respectQuietHours: true,
  metadata: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

const baseTarget: ReminderTargetSnapshot = {
  id: "bkps_1",
  bookingId: "book_1",
  dueDate: "2026-05-15",
  issuedAt: null,
  departureDate: "2026-05-20",
  bookingCreatedAt: "2026-04-01T00:00:00Z",
  status: "due",
  isTerminal: false,
}

const baseRule: NotificationReminderRule = {
  id: "ntrl_1",
  slug: "test-rule",
  name: "Test Rule",
  status: "active",
  targetType: "booking_payment_schedule",
  channel: "email",
  provider: null,
  templateId: null,
  templateSlug: "tpl",
  priority: 0,
  suppressionGroup: null,
  isSystem: false,
  metadata: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

describe("pickActiveStage", () => {
  it("returns null when no stages", () => {
    expect(pickActiveStage([], 0)).toBeNull()
  })

  it("returns first stage when caps are unbounded and zero sends", () => {
    const s1 = { ...baseStage, id: "s1" }
    const s2 = { ...baseStage, id: "s2", orderIndex: 1 }
    expect(pickActiveStage([s1, s2], 0)?.id).toBe("s1")
  })

  it("walks cumulative caps to advance stage", () => {
    const s1 = { ...baseStage, id: "s1", maxSendsInStage: 1 }
    const s2 = { ...baseStage, id: "s2", orderIndex: 1, maxSendsInStage: 2 }
    const s3 = { ...baseStage, id: "s3", orderIndex: 2, maxSendsInStage: null }
    expect(pickActiveStage([s1, s2, s3], 0)?.id).toBe("s1")
    expect(pickActiveStage([s1, s2, s3], 1)?.id).toBe("s2")
    expect(pickActiveStage([s1, s2, s3], 2)?.id).toBe("s2")
    expect(pickActiveStage([s1, s2, s3], 3)?.id).toBe("s3")
    expect(pickActiveStage([s1, s2, s3], 99)?.id).toBe("s3")
  })

  it("returns null after all bounded stages exhausted", () => {
    const s1 = { ...baseStage, id: "s1", maxSendsInStage: 1 }
    const s2 = { ...baseStage, id: "s2", orderIndex: 1, maxSendsInStage: 1 }
    expect(pickActiveStage([s1, s2], 2)).toBeNull()
  })
})

describe("inWindow", () => {
  const anchor = new Date("2026-05-15T00:00:00Z")
  it("includes today when within [start,end] of anchor", () => {
    expect(inWindow(new Date("2026-05-10T12:00:00Z"), anchor, baseStage)).toBe(true)
    expect(inWindow(new Date("2026-05-15T23:00:00Z"), anchor, baseStage)).toBe(true)
    expect(inWindow(new Date("2026-05-08T00:00:00Z"), anchor, baseStage)).toBe(true)
  })
  it("excludes outside the window", () => {
    expect(inWindow(new Date("2026-05-07T00:00:00Z"), anchor, baseStage)).toBe(false)
    expect(inWindow(new Date("2026-05-16T00:00:00Z"), anchor, baseStage)).toBe(false)
  })
})

describe("cadenceElapsed", () => {
  const today = new Date("2026-05-10T00:00:00Z")
  it("once: fires only when no prior send", () => {
    expect(cadenceElapsed(today, null, { ...baseStage, cadenceKind: "once" }, null)).toBe(true)
    const last = new Date("2026-05-08T00:00:00Z")
    expect(cadenceElapsed(today, last, { ...baseStage, cadenceKind: "once" }, null)).toBe(false)
  })
  it("every_n_days: respects threshold", () => {
    const stage = { ...baseStage, cadenceKind: "every_n_days" as const, cadenceEveryDays: 3 }
    expect(cadenceElapsed(today, null, stage, null)).toBe(true)
    expect(cadenceElapsed(today, new Date("2026-05-09T00:00:00Z"), stage, null)).toBe(false)
    expect(cadenceElapsed(today, new Date("2026-05-07T00:00:00Z"), stage, null)).toBe(true)
  })
  it("escalating: picks bucket by daysUntilDue", () => {
    const stage = {
      ...baseStage,
      cadenceKind: "escalating" as const,
      cadenceIntervals: [
        { whenDaysUntilDueGT: 60, repeatEveryDays: 14 },
        { whenDaysUntilDueGT: 30, repeatEveryDays: 7 },
        { repeatEveryDays: 3 },
      ],
    }
    // daysUntilDue = 75 → bucket every 14
    const lastSend = new Date("2026-05-03T00:00:00Z") // 7 days ago
    expect(cadenceElapsed(today, lastSend, stage, 75)).toBe(false)
    // daysUntilDue = 45 → bucket every 7
    expect(cadenceElapsed(today, lastSend, stage, 45)).toBe(true)
    // daysUntilDue = 5 → default bucket every 3
    expect(cadenceElapsed(today, new Date("2026-05-08T00:00:00Z"), stage, 5)).toBe(false)
    expect(cadenceElapsed(today, new Date("2026-05-06T00:00:00Z"), stage, 5)).toBe(true)
  })
})

describe("pickEscalatingInterval", () => {
  it("picks the first matching gt threshold", () => {
    const intervals = [
      { whenDaysUntilDueGT: 60, repeatEveryDays: 14 },
      { whenDaysUntilDueGT: 30, repeatEveryDays: 7 },
      { repeatEveryDays: 3 },
    ]
    expect(pickEscalatingInterval(intervals, 75)?.repeatEveryDays).toBe(14)
    expect(pickEscalatingInterval(intervals, 45)?.repeatEveryDays).toBe(7)
    expect(pickEscalatingInterval(intervals, 5)?.repeatEveryDays).toBe(3)
  })
  it("returns null for empty list", () => {
    expect(pickEscalatingInterval([], 5)).toBeNull()
    expect(pickEscalatingInterval(null, 5)).toBeNull()
  })
})

describe("resolveAnchor", () => {
  const history: SequenceHistoryEntry[] = []
  it("resolves due_date as midnight UTC", () => {
    expect(resolveAnchor("due_date", baseTarget, history)?.toISOString()).toBe(
      "2026-05-15T00:00:00.000Z",
    )
  })
  it("resolves departure_date", () => {
    expect(resolveAnchor("departure_date", baseTarget, history)?.toISOString()).toBe(
      "2026-05-20T00:00:00.000Z",
    )
  })
  it("resolves booking_created_at", () => {
    expect(resolveAnchor("booking_created_at", baseTarget, history)).toBeInstanceOf(Date)
  })
  it("returns null for last_send_at when no history", () => {
    expect(resolveAnchor("last_send_at", baseTarget, history)).toBeNull()
  })
  it("returns last sent date for last_send_at", () => {
    const sentAt = new Date("2026-05-08T10:00:00Z")
    const localHistory: SequenceHistoryEntry[] = [{ scheduledFor: sentAt, sentAt, status: "sent" }]
    expect(resolveAnchor("last_send_at", baseTarget, localHistory)?.toISOString()).toBe(
      sentAt.toISOString(),
    )
  })
})

describe("evaluateStage", () => {
  const today = new Date("2026-05-10T00:00:00Z")
  it("fires once when in window with no prior sends", () => {
    const stage = { ...baseStage, windowStartDays: -10, windowEndDays: 0 }
    const decision = evaluateStage(baseRule, [stage], baseTarget, [], today)
    expect(decision.fire).toBe(true)
    if (decision.fire) {
      expect(decision.sendCountAtFire).toBe(1)
      expect(decision.stage.id).toBe("ntrs_1")
    }
  })
  it("skips when target is terminal", () => {
    const decision = evaluateStage(
      baseRule,
      [baseStage],
      { ...baseTarget, isTerminal: true },
      [],
      today,
    )
    expect(decision.fire).toBe(false)
  })
  it("skips when outside window", () => {
    const stage = { ...baseStage, windowStartDays: 1, windowEndDays: 5 }
    const decision = evaluateStage(baseRule, [stage], baseTarget, [], today)
    expect(decision.fire).toBe(false)
    expect(decision.fire ? "" : decision.reason).toBe("outside_window")
  })
  it("skips when cadence not elapsed", () => {
    const stage = {
      ...baseStage,
      windowStartDays: -10,
      windowEndDays: 0,
      cadenceKind: "once" as const,
    }
    const sentAt = new Date("2026-05-09T00:00:00Z")
    const decision = evaluateStage(
      baseRule,
      [stage],
      baseTarget,
      [{ scheduledFor: sentAt, sentAt, status: "sent" }],
      today,
    )
    expect(decision.fire).toBe(false)
    expect(decision.fire ? "" : decision.reason).toBe("cadence_not_elapsed")
  })
})

describe("applyQuietHours", () => {
  const stage = { ...baseStage }
  it("returns now when respectQuietHours=false", () => {
    const now = new Date("2026-05-10T03:00:00Z")
    const result = applyQuietHours(
      now,
      { ...stage, respectQuietHours: false },
      {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        quietHoursLocal: { start: "22:00", end: "08:00", tz: "UTC" },
      },
    )
    expect(result.scheduledAt).toEqual(now)
    expect(result.deferred).toBe(false)
  })
  it("rolls forward through quiet hours", () => {
    const now = new Date("2026-05-10T03:00:00Z")
    const result = applyQuietHours(now, stage, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      quietHoursLocal: { start: "22:00", end: "08:00", tz: "UTC" },
    })
    expect(result.deferred).toBe(true)
    expect(result.scheduledAt.getUTCHours()).toBeGreaterThanOrEqual(8)
  })
  it("does not defer when outside quiet hours", () => {
    const now = new Date("2026-05-10T15:00:00Z")
    const result = applyQuietHours(now, stage, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      quietHoursLocal: { start: "22:00", end: "08:00", tz: "UTC" },
    })
    expect(result.deferred).toBe(false)
    expect(result.scheduledAt).toEqual(now)
  })
  it("respects blackout dates", () => {
    const now = new Date("2026-05-10T15:00:00Z")
    const result = applyQuietHours(now, stage, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      blackoutDates: ["2026-05-10"],
    })
    expect(result.deferred).toBe(true)
  })
})
