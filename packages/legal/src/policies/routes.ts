import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { policiesService } from "./service.js"
import {
  evaluateCancellationInputSchema,
  insertPolicyAcceptanceSchema,
  insertPolicyAssignmentSchema,
  insertPolicyRuleSchema,
  insertPolicySchema,
  insertPolicyVersionSchema,
  policyAcceptanceListQuerySchema,
  policyAssignmentListQuerySchema,
  policyListQuerySchema,
  resolvePolicyInputSchema,
  updatePolicyAssignmentSchema,
  updatePolicyRuleSchema,
  updatePolicySchema,
  updatePolicyVersionSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

// ============================================================================
// Policies admin routes — `/v1/admin/policies/*`
// ============================================================================

export const policiesAdminRoutes = new Hono<Env>()

  // ---------- policies ----------

  .get("/", async (c) => {
    const query = parseQuery(c, policyListQuerySchema)
    return c.json(await policiesService.listPolicies(c.get("db"), query))
  })

  .post("/", async (c) => {
    const row = await policiesService.createPolicy(
      c.get("db"),
      await parseJsonBody(c, insertPolicySchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/resolve", async (c) => {
    const input = parseQuery(c, resolvePolicyInputSchema)
    const result = await policiesService.resolvePolicy(c.get("db"), input)
    if (!result) return c.json({ data: null })
    return c.json({ data: result })
  })

  // ---------- versions ----------

  .get("/:id/versions", async (c) => {
    const rows = await policiesService.listPolicyVersions(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .post("/:id/versions", async (c) => {
    const version = await policiesService.createPolicyVersion(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertPolicyVersionSchema),
    )
    if (!version) return c.json({ error: "Policy not found" }, 404)
    return c.json({ data: version }, 201)
  })

  .get("/versions/:versionId", async (c) => {
    const row = await policiesService.getPolicyVersionById(c.get("db"), c.req.param("versionId"))
    if (!row) return c.json({ error: "Policy version not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/versions/:versionId", async (c) => {
    const row = await policiesService.updatePolicyVersion(
      c.get("db"),
      c.req.param("versionId"),
      await parseJsonBody(c, updatePolicyVersionSchema),
    )
    if (!row) return c.json({ error: "Policy version not found or not a draft" }, 404)
    return c.json({ data: row })
  })

  .post("/versions/:versionId/publish", async (c) => {
    const result = await policiesService.publishPolicyVersion(c.get("db"), c.req.param("versionId"))
    if (result.status === "not_found") return c.json({ error: "Policy version not found" }, 404)
    if (result.status === "not_draft") {
      return c.json({ error: "Only draft versions can be published" }, 409)
    }
    return c.json({ data: result.version })
  })

  .post("/versions/:versionId/retire", async (c) => {
    const row = await policiesService.retirePolicyVersion(c.get("db"), c.req.param("versionId"))
    if (!row) return c.json({ error: "Policy version not found" }, 404)
    return c.json({ data: row })
  })

  // ---------- rules ----------

  .get("/versions/:versionId/rules", async (c) => {
    const rows = await policiesService.listPolicyRules(c.get("db"), c.req.param("versionId"))
    return c.json({ data: rows })
  })

  .post("/versions/:versionId/rules", async (c) => {
    const row = await policiesService.createPolicyRule(
      c.get("db"),
      c.req.param("versionId"),
      await parseJsonBody(c, insertPolicyRuleSchema),
    )
    if (!row) return c.json({ error: "Policy version not found" }, 404)
    return c.json({ data: row }, 201)
  })

  .patch("/rules/:ruleId", async (c) => {
    const row = await policiesService.updatePolicyRule(
      c.get("db"),
      c.req.param("ruleId"),
      await parseJsonBody(c, updatePolicyRuleSchema),
    )
    if (!row) return c.json({ error: "Policy rule not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/rules/:ruleId", async (c) => {
    const row = await policiesService.deletePolicyRule(c.get("db"), c.req.param("ruleId"))
    if (!row) return c.json({ error: "Policy rule not found" }, 404)
    return c.json({ success: true })
  })

  // ---------- assignments ----------

  .get("/assignments", async (c) => {
    const query = parseQuery(c, policyAssignmentListQuerySchema)
    return c.json(await policiesService.listPolicyAssignments(c.get("db"), query))
  })

  .post("/assignments", async (c) => {
    const row = await policiesService.createPolicyAssignment(
      c.get("db"),
      await parseJsonBody(c, insertPolicyAssignmentSchema),
    )
    return c.json({ data: row }, 201)
  })

  .patch("/assignments/:id", async (c) => {
    const row = await policiesService.updatePolicyAssignment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePolicyAssignmentSchema),
    )
    if (!row) return c.json({ error: "Policy assignment not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/assignments/:id", async (c) => {
    const row = await policiesService.deletePolicyAssignment(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Policy assignment not found" }, 404)
    return c.json({ success: true })
  })

  // ---------- acceptances ----------

  .get("/acceptances", async (c) => {
    const query = parseQuery(c, policyAcceptanceListQuerySchema)
    return c.json(await policiesService.listPolicyAcceptances(c.get("db"), query))
  })

  .post("/acceptances", async (c) => {
    const row = await policiesService.recordPolicyAcceptance(
      c.get("db"),
      await parseJsonBody(c, insertPolicyAcceptanceSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/:id", async (c) => {
    const row = await policiesService.getPolicyById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Policy not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/:id", async (c) => {
    const row = await policiesService.updatePolicy(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePolicySchema),
    )
    if (!row) return c.json({ error: "Policy not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/:id", async (c) => {
    const row = await policiesService.deletePolicy(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Policy not found" }, 404)
    return c.json({ success: true })
  })

  .post("/:id/evaluate", async (c) => {
    const input = await parseJsonBody(c, evaluateCancellationInputSchema)
    const result = await policiesService.evaluateCancellation(c.get("db"), c.req.param("id"), input)
    if (!result) return c.json({ error: "Policy or current version not found" }, 404)
    return c.json({ data: result })
  })

export type PoliciesAdminRoutes = typeof policiesAdminRoutes

// ============================================================================
// Policies public routes — `/v1/public/policies/*`
// Customer-facing: fetch current published version by slug + record acceptance
// ============================================================================

export const policiesPublicRoutes = new Hono<Env>()

  .get("/:slug", async (c) => {
    const policy = await policiesService.getPolicyBySlug(c.get("db"), c.req.param("slug"))
    if (!policy) return c.json({ error: "Policy not found" }, 404)
    if (!policy.currentVersionId) {
      return c.json({ error: "Policy has no published version" }, 404)
    }
    const version = await policiesService.getPolicyVersionById(c.get("db"), policy.currentVersionId)
    if (!version || version.status !== "published") {
      return c.json({ error: "Policy has no published version" }, 404)
    }
    return c.json({ data: { policy, version } })
  })

  .post("/:id/accept", async (c) => {
    const input = await parseJsonBody(c, insertPolicyAcceptanceSchema)
    const row = await policiesService.recordPolicyAcceptance(c.get("db"), input)
    return c.json({ data: row }, 201)
  })

export type PoliciesPublicRoutes = typeof policiesPublicRoutes
