import { describe, expect, it } from "vitest"

import { DB_AVAILABLE, json, setupDistributionRoutes } from "./routes.setup.js"

describe.skipIf(!DB_AVAILABLE)("Distribution channel routes", () => {
  const ctx = setupDistributionRoutes()

  describe("Channels CRUD", () => {
    it("creates a channel", async () => {
      const res = await ctx.app.request("/channels", {
        method: "POST",
        ...json({ name: "Viator", kind: "ota" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toBeTruthy()
      expect(body.data.name).toBe("Viator")
      expect(body.data.kind).toBe("ota")
      expect(body.data.status).toBe("active")
    })

    it("creates a channel with identity fields", async () => {
      const res = await ctx.app.request("/channels", {
        method: "POST",
        ...json({
          name: "GetYourGuide",
          kind: "marketplace",
          website: "https://getyourguide.com",
          contactName: "John Doe",
          contactEmail: "john@gyg.com",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.website).toBe("https://getyourguide.com")
      expect(body.data.contactName).toBe("John Doe")
      expect(body.data.contactEmail).toBe("john@gyg.com")
    })

    it("lists channels", async () => {
      await ctx.seedChannel()
      const res = await ctx.app.request("/channels", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it("lists channels filtered by kind", async () => {
      await ctx.seedChannel({ kind: "direct" })
      await ctx.seedChannel({ kind: "ota" })
      const res = await ctx.app.request("/channels?kind=direct", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.kind === "direct")).toBe(true)
    })

    it("lists channels filtered by status", async () => {
      await ctx.seedChannel({ status: "inactive" })
      await ctx.seedChannel({ status: "active" })
      const res = await ctx.app.request("/channels?status=inactive", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.status === "inactive")).toBe(true)
    })

    it("gets a channel by id", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(channel.id)
    })

    it("updates a channel", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Channel" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.name).toBe("Updated Channel")
    })

    it("deletes a channel", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent channel", async () => {
      const res = await ctx.app.request("/channels/chan_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Channel batch operations", () => {
    it("batch-updates channels", async () => {
      const c1 = await ctx.seedChannel()
      const c2 = await ctx.seedChannel()
      const res = await ctx.app.request("/channels/batch-update", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id], patch: { status: "inactive" } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("batch-deletes channels", async () => {
      const c1 = await ctx.seedChannel()
      const c2 = await ctx.seedChannel()
      const res = await ctx.app.request("/channels/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("reports failures for non-existent ids in batch-delete", async () => {
      const c1 = await ctx.seedChannel()
      const res = await ctx.app.request("/channels/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, "chan_00000000000000000000000000"] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed.length).toBe(1)
    })
  })

  describe("Channel Contact Points", () => {
    it("lists contact points for a channel", async () => {
      const channel = await ctx.seedChannel({ website: "https://example.com" })
      const res = await ctx.app.request(`/channels/${channel.id}/contact-points`, { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    it("creates a contact point for a channel", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}/contact-points`, {
        method: "POST",
        ...json({ kind: "email", label: "support", value: "support@channel.com" }),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).data.value).toBe("support@channel.com")
    })

    it("returns 404 for contact points on non-existent channel", async () => {
      const res = await ctx.app.request(
        "/channels/chan_00000000000000000000000000/contact-points",
        {
          method: "GET",
        },
      )
      expect(res.status).toBe(404)
    })
  })

  describe("Channel Named Contacts", () => {
    it("lists named contacts for a channel", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}/contacts`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data).toBeInstanceOf(Array)
    })

    it("creates a named contact for a channel", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request(`/channels/${channel.id}/contacts`, {
        method: "POST",
        ...json({ name: "Jane Smith", role: "sales", email: "jane@channel.com" }),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).data.name).toBe("Jane Smith")
    })

    it("returns 404 for contacts on non-existent channel", async () => {
      const res = await ctx.app.request("/channels/chan_00000000000000000000000000/contacts", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Contracts ─────────────────────────────────────────────
})
