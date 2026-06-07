import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { createNotificationsTestContext, DB_AVAILABLE, json } from "./test-helpers"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function queryRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.filter(isRecord)
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows.filter(isRecord)
  }
  return []
}

describe.skipIf(!DB_AVAILABLE)("Reminder sequences (stage-based dispatcher)", () => {
  const ctx = createNotificationsTestContext()

  it("queues a stage's channel deliveries when the window matches and dedups across runs", async () => {
    // Seed a template the stage channel will use.
    const tmplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "payment-reminder-first",
        name: "Payment reminder — first",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Payment due for {{ bookingNumber }}",
        textTemplate: "Due {{ dueDate }} amount {{ amountCents }} {{ currency }}",
      }),
    })
    expect(tmplRes.status).toBe(201)
    const { data: template } = await tmplRes.json()

    // Seed a booking + traveler + open payment schedule due 2026-04-10.
    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, person_id, sell_currency, sell_amount_cents, start_date)
      VALUES ('book_seq_1', 'BK-SEQ-1', 'person_seq_1', 'EUR', 45000, DATE '2026-05-01')
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_seq_1', 'book_seq_1', 'Ana', 'Traveler', 'ana@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_seq_1', 'book_seq_1', 'balance', 'pending', DATE '2026-04-10', 'EUR', 25000)
    `)

    // Create the rule. With the new model templates are optional at the rule
    // level; the stage's channel carries the actual template.
    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "payment-balance-sequence",
        name: "Payment balance sequence",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
      }),
    })
    expect(ruleRes.status).toBe(201)
    const { data: rule } = await ruleRes.json()

    // Add one stage: anchor due_date, window [-7, 0] days, fire once.
    const stageRes = await ctx.request(`/reminder-rules/${rule.id}/stages`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        anchor: "due_date",
        windowStartDays: -7,
        windowEndDays: 0,
        cadenceKind: "once",
        respectQuietHours: false,
      }),
    })
    expect(stageRes.status).toBe(201)
    const { data: stage } = await stageRes.json()

    // Attach an email channel that points at the seeded template.
    const channelRes = await ctx.request(`/reminder-rules/${rule.id}/stages/${stage.id}/channels`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        channel: "email",
        provider: "local",
        templateId: template.id,
        recipientKind: "primary",
      }),
    })
    expect(channelRes.status).toBe(201)

    // First sweep at 2026-04-08 — five days before due, inside the [-7, 0] window.
    const firstRes = await ctx.request("/reminders/run-due", {
      method: "POST",
      ...json({ now: "2026-04-08T09:00:00.000Z" }),
    })
    expect(firstRes.status).toBe(200)
    const firstBody = await firstRes.json()
    expect(firstBody.data.processed).toBe(1)
    expect(firstBody.data.sent).toBe(1)
    expect(ctx.sink).toHaveBeenCalledOnce()
    const sinkPayload = ctx.sink.mock.calls[0]?.[0] as { to?: string } | undefined
    expect(sinkPayload?.to).toBe("ana@example.com")

    // Second sweep on the same calendar day must be a no-op: cadence='once'
    // plus same-day dedupe key prevents a second fire.
    const secondRes = await ctx.request("/reminders/run-due", {
      method: "POST",
      ...json({ now: "2026-04-08T18:00:00.000Z" }),
    })
    expect(secondRes.status).toBe(200)
    const secondBody = await secondRes.json()
    expect(secondBody.data.processed).toBe(0)
    expect(secondBody.data.sent).toBe(0)
    expect(ctx.sink).toHaveBeenCalledOnce()

    // Third sweep the next day — still 'once' cadence and there's already a
    // 'sent' run for this (rule, target), so no new fire.
    const thirdRes = await ctx.request("/reminders/run-due", {
      method: "POST",
      ...json({ now: "2026-04-09T09:00:00.000Z" }),
    })
    expect(thirdRes.status).toBe(200)
    const thirdBody = await thirdRes.json()
    expect(thirdBody.data.sent).toBe(0)
    expect(ctx.sink).toHaveBeenCalledOnce()

    // The stored run has the stage metadata wired through.
    const runs = await ctx.db.execute(sql`
      SELECT status, recipient, metadata
      FROM notification_reminder_runs
      WHERE reminder_rule_id = ${rule.id}
    `)
    const rows = queryRows(runs)
    expect(rows.length).toBe(1)
    expect(rows[0]!.status).toBe("sent")
    expect(rows[0]!.recipient).toBe("ana@example.com")
    const meta = rows[0]!.metadata as Record<string, unknown>
    expect(meta.stageId).toBe(stage.id)
    expect(meta.channel).toBe("email")
    expect(meta.sendCountAtFire).toBe(1)
  })

  it("does not fire when the stage's window has not opened yet", async () => {
    // Seed a template + booking + open schedule due 2026-06-30.
    const tmplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "tpl-window-test",
        name: "Window test",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "x",
        textTemplate: "x",
      }),
    })
    const { data: template } = await tmplRes.json()

    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, sell_currency)
      VALUES ('book_window_1', 'BK-WIN-1', 'EUR')
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_window_1', 'book_window_1', 'Ben', 'Late', 'ben@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_window_1', 'book_window_1', 'balance', 'pending', DATE '2026-06-30', 'EUR', 10000)
    `)

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "window-rule",
        name: "Window rule",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
      }),
    })
    const { data: rule } = await ruleRes.json()

    const stageRes = await ctx.request(`/reminder-rules/${rule.id}/stages`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        anchor: "due_date",
        // Window opens 7 days before and closes 3 days before. Today
        // (2026-04-08) is well outside — no fire.
        windowStartDays: -7,
        windowEndDays: -3,
        cadenceKind: "once",
        respectQuietHours: false,
      }),
    })
    const { data: stage } = await stageRes.json()

    await ctx.request(`/reminder-rules/${rule.id}/stages/${stage.id}/channels`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        channel: "email",
        provider: "local",
        templateId: template.id,
        recipientKind: "primary",
      }),
    })

    const sweepRes = await ctx.request("/reminders/run-due", {
      method: "POST",
      ...json({ now: "2026-04-08T09:00:00.000Z" }),
    })
    expect(sweepRes.status).toBe(200)
    const body = await sweepRes.json()
    expect(body.data.processed).toBe(0)
    expect(body.data.sent).toBe(0)
  })

  it("does not fire payment schedule reminders for cancelled bookings", async () => {
    const tmplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "tpl-cancelled-booking-payment",
        name: "Cancelled booking payment reminder",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Payment due",
        textTemplate: "Payment due",
      }),
    })
    const { data: template } = await tmplRes.json()

    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, status, sell_currency)
      VALUES ('book_cancelled_seq_1', 'BK-CAN-1', 'cancelled', 'EUR')
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_cancelled_seq_1', 'book_cancelled_seq_1', 'Ana', 'Cancelled', 'ana-cancelled@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_cancelled_seq_1', 'book_cancelled_seq_1', 'balance', 'due', DATE '2026-04-10', 'EUR', 25000)
    `)

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "cancelled-payment-balance-sequence",
        name: "Cancelled payment balance sequence",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
      }),
    })
    const { data: rule } = await ruleRes.json()

    const stageRes = await ctx.request(`/reminder-rules/${rule.id}/stages`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        anchor: "due_date",
        windowStartDays: -7,
        windowEndDays: 0,
        cadenceKind: "once",
        respectQuietHours: false,
      }),
    })
    const { data: stage } = await stageRes.json()

    await ctx.request(`/reminder-rules/${rule.id}/stages/${stage.id}/channels`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        channel: "email",
        provider: "local",
        templateId: template.id,
        recipientKind: "primary",
      }),
    })

    const sweepRes = await ctx.request("/reminders/run-due", {
      method: "POST",
      ...json({ now: "2026-04-08T09:00:00.000Z" }),
    })
    expect(sweepRes.status).toBe(200)
    const body = await sweepRes.json()
    expect(body.data.processed).toBe(0)
    expect(body.data.sent).toBe(0)
    expect(ctx.sink).not.toHaveBeenCalled()
  })

  it("queues per-channel and uses the stage channel's template at delivery time", async () => {
    // Two templates: one is the rule's default fallback that should NEVER be
    // used, the other lives on the stage channel and is the one we expect to
    // hit the wire.
    const ruleDefaultTplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "rule-default-do-not-use",
        name: "Rule default (must not be used)",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "WRONG",
        textTemplate: "WRONG",
      }),
    })
    const { data: ruleDefaultTpl } = await ruleDefaultTplRes.json()

    const stageChannelTplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "stage-channel-correct",
        name: "Stage channel template",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Stage payment due {{ bookingNumber }}",
        textTemplate: "Stage delivery — due {{ dueDate }}",
      }),
    })
    const { data: stageChannelTpl } = await stageChannelTplRes.json()

    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, person_id, sell_currency, sell_amount_cents)
      VALUES ('book_q_1', 'BK-Q-1', 'person_q_1', 'EUR', 30000)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_q_1', 'book_q_1', 'Cara', 'Queue', 'cara@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_q_1', 'book_q_1', 'balance', 'pending', DATE '2026-04-12', 'EUR', 18000)
    `)

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "queued-balance-rule",
        name: "Queued balance rule",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
        templateId: ruleDefaultTpl.id,
      }),
    })
    const { data: rule } = await ruleRes.json()

    const stageRes = await ctx.request(`/reminder-rules/${rule.id}/stages`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        anchor: "due_date",
        windowStartDays: -7,
        windowEndDays: 0,
        cadenceKind: "once",
        respectQuietHours: false,
      }),
    })
    const { data: stage } = await stageRes.json()

    await ctx.request(`/reminder-rules/${rule.id}/stages/${stage.id}/channels`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        channel: "email",
        provider: "local",
        templateId: stageChannelTpl.id,
        recipientKind: "primary",
      }),
    })

    // Drive the queue path directly. The route does the full
    // queueDueReminders -> stage pipeline -> emit per-channel queued runs.
    const { queueDueReminders, deliverReminderRun } = await import("../../src/service-reminders.js")
    const { createNotificationService } = await import("../../src/service.js")
    const { createLocalProvider } = await import("../../src/providers/local.js")

    const enqueued: { reminderRunId: string }[] = []
    const queueResult = await queueDueReminders(
      ctx.db as never,
      { now: "2026-04-09T09:00:00.000Z" },
      async (job) => {
        enqueued.push(job)
      },
    )
    expect(queueResult.queued).toBe(1)
    expect(enqueued).toHaveLength(1)

    // Sanity-check that the run was annotated with the stage channel id —
    // that's what resolveChannelOverride keys off.
    const queuedRows = await ctx.db.execute(sql`
      SELECT status, metadata FROM notification_reminder_runs
      WHERE reminder_rule_id = ${rule.id}
    `)
    const queuedRowsAny = queryRows(queuedRows)
    expect(queuedRowsAny.length).toBe(1)
    expect(queuedRowsAny[0]!.status).toBe("queued")
    const queuedMeta = queuedRowsAny[0]!.metadata as Record<string, unknown>
    expect(queuedMeta.stageChannelId).toBeTruthy()

    // Now run the deliver workflow handler the way templates/operator/src/workflows.ts
    // would: hand it the run id, expect the stage channel's template (not the rule's).
    const recordedSends: Array<Record<string, unknown>> = []
    const localDispatcher = createNotificationService([
      createLocalProvider({
        sink: (payload) => recordedSends.push(payload as Record<string, unknown>),
        channels: ["email"],
      }),
    ])
    const delivered = await deliverReminderRun(ctx.db as never, localDispatcher, {
      reminderRunId: enqueued[0]!.reminderRunId,
    })
    expect(delivered?.status).toBe("sent")
    expect(recordedSends).toHaveLength(1)
    const sent = recordedSends[0]!
    expect(sent.subject).toContain("Stage payment due")
    expect(sent.text).toContain("Stage delivery")
    expect(sent.to).toBe("cara@example.com")
  })

  it("skips queued payment schedule reminder runs when the booking was cancelled before delivery", async () => {
    const tmplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "queued-cancelled-template",
        name: "Queued cancelled template",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Payment due",
        textTemplate: "Payment due",
      }),
    })
    const { data: template } = await tmplRes.json()

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "queued-cancelled-rule",
        name: "Queued cancelled rule",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
        templateId: template.id,
      }),
    })
    const { data: rule } = await ruleRes.json()

    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, status, sell_currency)
      VALUES ('book_queued_cancelled_1', 'BK-Q-CAN-1', 'cancelled', 'EUR')
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_queued_cancelled_1', 'book_queued_cancelled_1', 'Quinn', 'Cancelled', 'quinn@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_queued_cancelled_1', 'book_queued_cancelled_1', 'balance', 'due', DATE '2026-04-12', 'EUR', 18000)
    `)
    await ctx.db.execute(sql`
      INSERT INTO notification_reminder_runs (
        id, reminder_rule_id, target_type, target_id, dedupe_key, booking_id, status, recipient, scheduled_for
      )
      VALUES (
        'nrr_queued_cancelled_1',
        ${rule.id},
        'booking_payment_schedule',
        'bkps_queued_cancelled_1',
        'queued-cancelled-dedupe',
        'book_queued_cancelled_1',
        'queued',
        'quinn@example.com',
        TIMESTAMPTZ '2026-04-09T09:00:00.000Z'
      )
    `)

    const { deliverReminderRun } = await import("../../src/service-reminders.js")
    const { createNotificationService } = await import("../../src/service.js")
    const { createLocalProvider } = await import("../../src/providers/local.js")
    const recordedSends: Array<Record<string, unknown>> = []
    const localDispatcher = createNotificationService([
      createLocalProvider({
        sink: (payload) => recordedSends.push(payload as Record<string, unknown>),
        channels: ["email"],
      }),
    ])

    const delivered = await deliverReminderRun(ctx.db as never, localDispatcher, {
      reminderRunId: "nrr_queued_cancelled_1",
    })
    expect(delivered?.status).toBe("skipped")
    expect(delivered?.errorMessage).toBe("booking_status_cancelled")
    expect(recordedSends).toHaveLength(0)
  })

  it("does not requeue failed one-shot reminder runs on later sweeps", async () => {
    const tmplRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "missing-provider-reminder",
        name: "Missing provider reminder",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Payment due",
        textTemplate: "Payment due",
      }),
    })
    expect(tmplRes.status).toBe(201)
    const { data: template } = await tmplRes.json()

    await ctx.db.execute(sql`
      INSERT INTO bookings (id, booking_number, person_id, sell_currency, sell_amount_cents, start_date)
      VALUES ('book_failed_retry_1', 'BK-FAILED-RETRY-1', 'person_failed_retry_1', 'EUR', 45000, DATE '2026-05-01')
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, first_name, last_name, email, participant_type, is_primary)
      VALUES ('bkpt_failed_retry_1', 'book_failed_retry_1', 'Dana', 'Retry', 'dana@example.com', 'traveler', true)
    `)
    await ctx.db.execute(sql`
      INSERT INTO booking_payment_schedules (
        id, booking_id, schedule_type, status, due_date, currency, amount_cents
      )
      VALUES ('bkps_failed_retry_1', 'book_failed_retry_1', 'balance', 'pending', DATE '2026-04-10', 'EUR', 25000)
    `)

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "failed-retry-rule",
        name: "Failed retry rule",
        status: "active",
        targetType: "booking_payment_schedule",
        channel: "email",
        provider: "local",
      }),
    })
    expect(ruleRes.status).toBe(201)
    const { data: rule } = await ruleRes.json()

    const stageRes = await ctx.request(`/reminder-rules/${rule.id}/stages`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        anchor: "due_date",
        windowStartDays: -7,
        windowEndDays: 0,
        cadenceKind: "once",
        maxSendsInStage: 1,
        respectQuietHours: false,
      }),
    })
    expect(stageRes.status).toBe(201)
    const { data: stage } = await stageRes.json()

    await ctx.request(`/reminder-rules/${rule.id}/stages/${stage.id}/channels`, {
      method: "POST",
      ...json({
        orderIndex: 0,
        channel: "email",
        provider: "voyant-cloud-email",
        templateId: template.id,
        recipientKind: "primary",
      }),
    })

    const { queueDueReminders, deliverReminderRun } = await import("../../src/service-reminders.js")
    const { createNotificationService } = await import("../../src/service.js")
    const { createLocalProvider } = await import("../../src/providers/local.js")

    const enqueued: { reminderRunId: string }[] = []
    const firstQueue = await queueDueReminders(
      ctx.db as never,
      { now: "2026-04-08T09:00:00.000Z" },
      async (job) => {
        enqueued.push(job)
      },
    )
    expect(firstQueue.processed).toBe(1)
    expect(firstQueue.queued).toBe(1)
    expect(enqueued).toHaveLength(1)

    const localDispatcher = createNotificationService([
      createLocalProvider({ sink: () => undefined, channels: ["email"] }),
    ])
    const failed = await deliverReminderRun(ctx.db as never, localDispatcher, {
      reminderRunId: enqueued[0]!.reminderRunId,
    })
    expect(failed?.status).toBe("failed")
    expect(failed?.errorMessage).toContain(
      'No notification provider registered with name "voyant-cloud-email"',
    )

    const sameDayQueue = await queueDueReminders(
      ctx.db as never,
      { now: "2026-04-08T18:00:00.000Z" },
      async (job) => {
        enqueued.push(job)
      },
    )
    expect(sameDayQueue.processed).toBe(0)
    expect(sameDayQueue.queued).toBe(0)

    const nextDayQueue = await queueDueReminders(
      ctx.db as never,
      { now: "2026-04-09T09:00:00.000Z" },
      async (job) => {
        enqueued.push(job)
      },
    )
    expect(nextDayQueue.processed).toBe(0)
    expect(nextDayQueue.queued).toBe(0)
    expect(enqueued).toHaveLength(1)

    const rowsResult = await ctx.db.execute(sql`
      SELECT status, error_message
      FROM notification_reminder_runs
      WHERE reminder_rule_id = ${rule.id}
    `)
    const rows = queryRows(rowsResult)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe("failed")

    const deliveryCountResult = await ctx.db.execute(sql`
      SELECT count(*)::int AS count
      FROM notification_deliveries
      WHERE target_id = 'bkps_failed_retry_1'
    `)
    const deliveryCountRows = queryRows(deliveryCountResult)
    expect(deliveryCountRows[0]!.count).toBe(0)
  })
})
