import { describe, expect, it } from "vitest"

import { DB_AVAILABLE, json, setupDistributionRoutes } from "./routes.setup.js"

describe.skipIf(!DB_AVAILABLE)("Distribution settlement policy routes", () => {
  const ctx = setupDistributionRoutes()

  describe("Settlement Policies CRUD", () => {
    it("creates a settlement policy", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/settlement-policies", {
        method: "POST",
        ...json({
          channelId: channel.id,
          frequency: "weekly",
          autoGenerate: true,
          currencyCode: "USD",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.frequency).toBe("weekly")
      expect(body.data.autoGenerate).toBe(true)
    })

    it("lists settlement policies", async () => {
      const channel = await ctx.seedChannel()
      await ctx.app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const res = await ctx.app.request("/settlement-policies", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a settlement policy by id", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-policies/${policy.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(policy.id)
    })

    it("updates a settlement policy", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-policies/${policy.id}`, {
        method: "PATCH",
        ...json({ frequency: "monthly", approvalRequired: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.frequency).toBe("monthly")
      expect(body.data.approvalRequired).toBe(true)
    })

    it("deletes a settlement policy", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-policies/${policy.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement policy", async () => {
      const res = await ctx.app.request("/settlement-policies/chsp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Reconciliation Policies CRUD", () => {
    it("creates a reconciliation policy", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/reconciliation-policies", {
        method: "POST",
        ...json({
          channelId: channel.id,
          frequency: "daily",
          autoRun: true,
          amountToleranceCents: 100,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.frequency).toBe("daily")
      expect(body.data.autoRun).toBe(true)
      expect(body.data.amountToleranceCents).toBe(100)
    })

    it("lists reconciliation policies", async () => {
      const channel = await ctx.seedChannel()
      await ctx.app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const res = await ctx.app.request("/reconciliation-policies", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a reconciliation policy by id", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-policies/${policy.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(policy.id)
    })

    it("updates a reconciliation policy", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-policies/${policy.id}`, {
        method: "PATCH",
        ...json({ compareGrossAmounts: false }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.compareGrossAmounts).toBe(false)
    })

    it("deletes a reconciliation policy", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-policies/${policy.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation policy", async () => {
      const res = await ctx.app.request(
        "/reconciliation-policies/chrp_00000000000000000000000000",
        {
          method: "GET",
        },
      )
      expect(res.status).toBe(404)
    })
  })

  describe("Release Schedules CRUD", () => {
    it("creates a release schedule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const res = await ctx.app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id, scheduleKind: "daily" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.scheduleKind).toBe("daily")
      expect(body.data.active).toBe(true)
    })

    it("lists release schedules", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      await ctx.app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const res = await ctx.app.request("/release-schedules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release schedule by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const createRes = await ctx.app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await ctx.app.request(`/release-schedules/${schedule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(schedule.id)
    })

    it("updates a release schedule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const createRes = await ctx.app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await ctx.app.request(`/release-schedules/${schedule.id}`, {
        method: "PATCH",
        ...json({ scheduleKind: "hourly", active: false }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.scheduleKind).toBe("hourly")
      expect(body.data.active).toBe(false)
    })

    it("deletes a release schedule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const createRes = await ctx.app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await ctx.app.request(`/release-schedules/${schedule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release schedule", async () => {
      const res = await ctx.app.request("/release-schedules/chrs_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Remittance Exceptions CRUD", () => {
    it("creates a remittance exception", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/remittance-exceptions", {
        method: "POST",
        ...json({
          channelId: channel.id,
          exceptionType: "underpayment",
          severity: "error",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.exceptionType).toBe("underpayment")
      expect(body.data.severity).toBe("error")
      expect(body.data.status).toBe("open")
    })

    it("lists remittance exceptions", async () => {
      const channel = await ctx.seedChannel()
      await ctx.app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "duplicate" }),
      })
      const res = await ctx.app.request("/remittance-exceptions", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a remittance exception by id", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await ctx.app.request(`/remittance-exceptions/${exception.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(exception.id)
    })

    it("updates a remittance exception", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await ctx.app.request(`/remittance-exceptions/${exception.id}`, {
        method: "PATCH",
        ...json({ status: "resolved", notes: "Resolved manually" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("resolved")
      expect(body.data.notes).toBe("Resolved manually")
    })

    it("deletes a remittance exception", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await ctx.app.request(`/remittance-exceptions/${exception.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent remittance exception", async () => {
      const res = await ctx.app.request("/remittance-exceptions/chre_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Settlement Approvals CRUD", () => {
    it("creates a settlement approval", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({
          settlementRunId: run.id,
          approverUserId: "user_approver1",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.approverUserId).toBe("user_approver1")
      expect(body.data.status).toBe("pending")
    })

    it("lists settlement approvals", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await ctx.app.request("/settlement-approvals", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters settlement approvals by status", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await ctx.app.request("/settlement-approvals?status=pending", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((a: Record<string, unknown>) => a.status === "pending")).toBe(true)
    })

    it("gets a settlement approval by id", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-approvals/${approval.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(approval.id)
    })

    it("updates a settlement approval", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-approvals/${approval.id}`, {
        method: "PATCH",
        ...json({ status: "approved", notes: "Looks good" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("approved")
      expect(body.data.notes).toBe("Looks good")
    })

    it("deletes a settlement approval", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-approvals/${approval.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement approval", async () => {
      const res = await ctx.app.request("/settlement-approvals/chsa_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
