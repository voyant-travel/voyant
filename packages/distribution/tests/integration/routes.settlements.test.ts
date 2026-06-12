import { describe, expect, it } from "vitest"

import { DB_AVAILABLE, json, setupDistributionRoutes } from "./routes.setup.js"

describe.skipIf(!DB_AVAILABLE)("Distribution settlement routes", () => {
  const ctx = setupDistributionRoutes()

  describe("Settlement Runs CRUD", () => {
    it("creates a settlement run", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/settlement-runs", {
        method: "POST",
        ...json({
          channelId: channel.id,
          currencyCode: "EUR",
          periodStart: "2025-01-01",
          periodEnd: "2025-01-31",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.status).toBe("draft")
      expect(body.data.currencyCode).toBe("EUR")
    })

    it("lists settlement runs", async () => {
      const channel = await ctx.seedChannel()
      await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request("/settlement-runs", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a settlement run by id", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request(`/settlement-runs/${run.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(run.id)
    })

    it("updates a settlement run", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request(`/settlement-runs/${run.id}`, {
        method: "PATCH",
        ...json({ status: "open", statementReference: "STM-001" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("open")
      expect(body.data.statementReference).toBe("STM-001")
    })

    it("deletes a settlement run", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request(`/settlement-runs/${run.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement run", async () => {
      const res = await ctx.app.request("/settlement-runs/chsr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Settlement Items CRUD", () => {
    it("creates a settlement item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const res = await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({
          settlementRunId: run.id,
          grossAmountCents: 10000,
          commissionAmountCents: 1500,
          netRemittanceAmountCents: 8500,
          currencyCode: "EUR",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.grossAmountCents).toBe(10000)
      expect(body.data.commissionAmountCents).toBe(1500)
      expect(body.data.netRemittanceAmountCents).toBe(8500)
      expect(body.data.status).toBe("pending")
    })

    it("lists settlement items", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await ctx.app.request("/settlement-items", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters settlement items by settlementRunId", async () => {
      const channel = await ctx.seedChannel()
      const run1 = await ctx.seedSettlementRun(channel.id)
      const run2 = await ctx.seedSettlementRun(channel.id)
      await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run1.id }),
      })
      await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run2.id }),
      })
      const res = await ctx.app.request(`/settlement-items?settlementRunId=${run1.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.data.every((i: Record<string, unknown>) => i.settlementRunId === run1.id)).toBe(
        true,
      )
    })

    it("gets a settlement item by id", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-items/${item.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(item.id)
    })

    it("updates a settlement item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "approved" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("approved")
    })

    it("deletes a settlement item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedSettlementRun(channel.id)
      const createRes = await ctx.app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/settlement-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement item", async () => {
      const res = await ctx.app.request("/settlement-items/chsi_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Reconciliation Runs CRUD", () => {
    it("creates a reconciliation run", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/reconciliation-runs", {
        method: "POST",
        ...json({
          channelId: channel.id,
          periodStart: "2025-01-01",
          periodEnd: "2025-01-31",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.status).toBe("draft")
    })

    it("lists reconciliation runs", async () => {
      const channel = await ctx.seedChannel()
      await ctx.seedReconciliationRun(channel.id)
      const res = await ctx.app.request("/reconciliation-runs", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a reconciliation run by id", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const res = await ctx.app.request(`/reconciliation-runs/${run.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(run.id)
    })

    it("updates a reconciliation run", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const res = await ctx.app.request(`/reconciliation-runs/${run.id}`, {
        method: "PATCH",
        ...json({ status: "running" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("running")
    })

    it("deletes a reconciliation run", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const res = await ctx.app.request(`/reconciliation-runs/${run.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation run", async () => {
      const res = await ctx.app.request("/reconciliation-runs/chrr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Reconciliation Items CRUD", () => {
    it("creates a reconciliation item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const res = await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({
          reconciliationRunId: run.id,
          issueType: "amount_mismatch",
          severity: "error",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.issueType).toBe("amount_mismatch")
      expect(body.data.severity).toBe("error")
      expect(body.data.resolutionStatus).toBe("open")
    })

    it("lists reconciliation items", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const res = await ctx.app.request("/reconciliation-items", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters reconciliation items by issueType", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "missing_booking" }),
      })
      await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "status_mismatch" }),
      })
      const res = await ctx.app.request("/reconciliation-items?issueType=missing_booking", {
        method: "GET",
      })
      const body = await res.json()
      expect(
        body.data.every((i: Record<string, unknown>) => i.issueType === "missing_booking"),
      ).toBe(true)
    })

    it("gets a reconciliation item by id", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const createRes = await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-items/${item.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(item.id)
    })

    it("updates a reconciliation item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const createRes = await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-items/${item.id}`, {
        method: "PATCH",
        ...json({ resolutionStatus: "resolved", notes: "Fixed" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.resolutionStatus).toBe("resolved")
      expect(body.data.notes).toBe("Fixed")
    })

    it("deletes a reconciliation item", async () => {
      const channel = await ctx.seedChannel()
      const run = await ctx.seedReconciliationRun(channel.id)
      const createRes = await ctx.app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await ctx.app.request(`/reconciliation-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation item", async () => {
      const res = await ctx.app.request("/reconciliation-items/chri_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Release Executions CRUD", () => {
    it("creates a release execution", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request("/inventory-release-executions", {
        method: "POST",
        ...json({
          allotmentId: allotment.id,
          actionTaken: "released",
          releasedCapacity: 5,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.actionTaken).toBe("released")
      expect(body.data.releasedCapacity).toBe(5)
      expect(body.data.status).toBe("pending")
    })

    it("lists release executions", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      await ctx.app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const res = await ctx.app.request("/inventory-release-executions", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release execution by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-release-executions/${exec.id}`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(exec.id)
    })

    it("updates a release execution", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-release-executions/${exec.id}`, {
        method: "PATCH",
        ...json({ status: "completed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("completed")
    })

    it("deletes a release execution", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-release-executions/${exec.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release execution", async () => {
      const res = await ctx.app.request(
        "/inventory-release-executions/chre_00000000000000000000000000",
        { method: "GET" },
      )
      expect(res.status).toBe(404)
    })
  })
})
