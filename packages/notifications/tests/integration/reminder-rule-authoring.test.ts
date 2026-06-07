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

describe.skipIf(!DB_AVAILABLE)("Notification reminder rule authoring", () => {
  const ctx = createNotificationsTestContext()

  it("composes a full reminder rule graph from one request", async () => {
    const templateRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "compose-payment-reminder",
        name: "Compose payment reminder",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Payment due",
        textTemplate: "Please pay",
      }),
    })
    expect(templateRes.status).toBe(201)
    const { data: template } = await templateRes.json()

    const composeRes = await ctx.request("/reminder-rules/compose", {
      method: "POST",
      ...json({
        rule: {
          slug: "compose-payment-rule",
          name: "Compose payment rule",
          status: "active",
          targetType: "booking_payment_schedule",
          channel: "email",
          provider: "local",
          templateSlug: "compose-payment-reminder",
          priority: 20,
          suppressionGroup: "booking-payment",
        },
        stages: [
          {
            orderIndex: 0,
            name: "First touch",
            anchor: "due_date",
            windowStartDays: -7,
            windowEndDays: 0,
            cadenceKind: "once",
            respectQuietHours: false,
            channels: [
              {
                orderIndex: 0,
                channel: "email",
                provider: "local",
                recipientKind: "primary",
              },
            ],
          },
        ],
      }),
    })

    expect(composeRes.status).toBe(201)
    const { data } = await composeRes.json()
    expect(data.ruleId).toMatch(/^ntrl_/)
    expect(data.stages).toHaveLength(1)
    expect(data.stages[0].channels).toHaveLength(1)

    const stagesRes = await ctx.request(`/reminder-rules/${data.ruleId}/stages`)
    const { data: stages } = await stagesRes.json()
    expect(stages[0]).toMatchObject({
      id: data.stages[0].id,
      orderIndex: 0,
      cadenceKind: "once",
    })

    const channelsRes = await ctx.request(
      `/reminder-rules/${data.ruleId}/stages/${data.stages[0].id}/channels`,
    )
    const { data: channels } = await channelsRes.json()
    expect(channels[0]).toMatchObject({
      id: data.stages[0].channels[0].id,
      templateId: template.id,
      templateSlug: "compose-payment-reminder",
      channel: "email",
    })
  })

  it("returns recoverable validation issues without inserting a partial graph", async () => {
    await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "compose-sms-template",
        name: "Compose SMS template",
        channel: "sms",
        provider: "local",
        status: "active",
        textTemplate: "SMS",
      }),
    })

    const composeRes = await ctx.request("/reminder-rules/compose", {
      method: "POST",
      ...json({
        rule: {
          slug: "bad-compose-rule",
          name: "Bad compose rule",
          status: "active",
          targetType: "booking_payment_schedule",
          channel: "email",
        },
        stages: [
          {
            orderIndex: 0,
            anchor: "due_date",
            windowStartDays: 3,
            windowEndDays: 1,
            cadenceKind: "every_n_days",
            respectQuietHours: true,
            channels: [
              {
                orderIndex: 0,
                channel: "email",
                templateSlug: "compose-sms-template",
                recipientKind: "primary",
              },
            ],
          },
        ],
      }),
    })

    expect(composeRes.status).toBe(422)
    const body = await composeRes.json()
    const codes = body.issues.map((issue: { code: string }) => issue.code)
    expect(codes).toContain("invalid_stage_window")
    expect(codes).toContain("cadence_every_days_required")
    expect(codes).toContain("template_channel_mismatch")
    expect(body.issues[0]).toHaveProperty("fix")

    const rows = queryRows(
      await ctx.db.execute(sql`
        SELECT id FROM notification_reminder_rules WHERE slug = 'bad-compose-rule'
      `),
    )
    expect(rows).toHaveLength(0)
  })

  it("replays a compose request by idempotency key", async () => {
    await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "compose-idempotent-template",
        name: "Compose idempotent template",
        channel: "email",
        provider: "local",
        status: "active",
        textTemplate: "Reminder",
      }),
    })

    const init = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "compose-reminder-rule-once",
      },
      body: JSON.stringify({
        rule: {
          slug: "compose-idempotent-rule",
          name: "Compose idempotent rule",
          status: "active",
          targetType: "booking_payment_schedule",
          channel: "email",
          templateSlug: "compose-idempotent-template",
        },
        stages: [
          {
            orderIndex: 0,
            anchor: "due_date",
            windowStartDays: -3,
            windowEndDays: 0,
            cadenceKind: "once",
            respectQuietHours: true,
            channels: [{ orderIndex: 0, channel: "email", recipientKind: "primary" }],
          },
        ],
      }),
    }

    const firstRes = await ctx.request("/reminder-rules/compose", init)
    expect(firstRes.status).toBe(201)
    const firstBody = await firstRes.json()

    const secondRes = await ctx.request("/reminder-rules/compose", init)
    expect(secondRes.status).toBe(200)
    const secondBody = await secondRes.json()
    expect(secondBody.data).toEqual(firstBody.data)

    const rows = queryRows(
      await ctx.db.execute(sql`
        SELECT id FROM notification_reminder_rules WHERE slug = 'compose-idempotent-rule'
      `),
    )
    expect(rows).toHaveLength(1)
  })

  it("hard-deletes templates and reminder rules", async () => {
    const templateRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "delete-template",
        name: "Delete template",
        channel: "email",
        provider: "local",
        status: "draft",
        textTemplate: "Delete",
      }),
    })
    const { data: template } = await templateRes.json()

    const deleteTemplateRes = await ctx.request(`/templates/${template.id}`, { method: "DELETE" })
    expect(deleteTemplateRes.status).toBe(204)
    const missingTemplateRes = await ctx.request(`/templates/${template.id}`)
    expect(missingTemplateRes.status).toBe(404)

    const ruleRes = await ctx.request("/reminder-rules", {
      method: "POST",
      ...json({
        slug: "delete-rule",
        name: "Delete rule",
        status: "draft",
        targetType: "booking_payment_schedule",
        channel: "email",
      }),
    })
    const { data: rule } = await ruleRes.json()

    const deleteRuleRes = await ctx.request(`/reminder-rules/${rule.id}`, { method: "DELETE" })
    expect(deleteRuleRes.status).toBe(204)
    const missingRuleRes = await ctx.request(`/reminder-rules/${rule.id}`)
    expect(missingRuleRes.status).toBe(404)
  })
})
