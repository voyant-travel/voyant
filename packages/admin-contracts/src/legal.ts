/**
 * Legal admin operations: contracts (CRUD + issue/send/void) and policies
 * (CRUD + cancellation evaluation).
 *
 * Input schemas derive from `@voyantjs/legal-contracts` so the SDK can't drift
 * from the routes. Output schemas stay loose client-facing projections
 * (ADR-0003) — unknown server fields are stripped, not rejected.
 */

import {
  contractListQuerySchema,
  insertContractSchema,
  updateContractSchema,
} from "@voyantjs/legal-contracts/contracts/validation"
import {
  evaluateCancellationInputSchema,
  insertPolicySchema,
  policyListQuerySchema,
  updatePolicySchema,
} from "@voyantjs/legal-contracts/policies/validation"
import { z } from "zod"

import { defineOperation } from "./core/operation.js"
import { paginated } from "./core/pagination.js"

export const contractSummarySchema = z.object({
  id: z.string(),
  status: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type ContractSummary = z.infer<typeof contractSummarySchema>

export const policySummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type PolicySummary = z.infer<typeof policySummarySchema>

// List inputs derive from the canonical route query schemas so the SDK
// advertises exactly the filters the routes accept — not a hand-written subset
// that the server would silently strip (Codex P2). `policyListQuerySchema`
// notably has no `status` filter (it offers `kind`/`language`/`search`).
export const contractsListInputSchema = contractListQuerySchema
export const policiesListInputSchema = policyListQuerySchema

const contractsList = defineOperation({
  id: "legal.contracts.list",
  method: "GET",
  path: () => "/v1/admin/legal/contracts",
  pathTemplate: "/v1/admin/legal/contracts",
  input: contractsListInputSchema,
  output: paginated(contractSummarySchema),
  classification: "read",
  scopes: ["legal:read"],
  envelope: "raw",
  summary: "List legal contracts with filters and offset pagination.",
})

const contractsGet = defineOperation({
  id: "legal.contracts.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/legal/contracts/${p.id}`,
  pathTemplate: "/v1/admin/legal/contracts/:id",
  input: z.object({}),
  output: contractSummarySchema,
  classification: "read",
  scopes: ["legal:read"],
  summary: "Get a single contract by id.",
})

const contractsCreate = defineOperation({
  id: "legal.contracts.create",
  method: "POST",
  path: () => "/v1/admin/legal/contracts",
  pathTemplate: "/v1/admin/legal/contracts",
  input: insertContractSchema,
  output: contractSummarySchema,
  classification: "routine_write",
  scopes: ["legal:write"],
  idempotent: true,
  summary: "Create a contract.",
})

const contractsUpdate = defineOperation({
  id: "legal.contracts.update",
  method: "PATCH",
  path: (p: { id: string }) => `/v1/admin/legal/contracts/${p.id}`,
  pathTemplate: "/v1/admin/legal/contracts/:id",
  input: updateContractSchema,
  output: contractSummarySchema,
  classification: "routine_write",
  scopes: ["legal:write"],
  summary: "Update a contract.",
})

const contractsIssue = defineOperation({
  id: "legal.contracts.issue",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/legal/contracts/${p.id}/issue`,
  pathTemplate: "/v1/admin/legal/contracts/:id/issue",
  input: z.object({}),
  output: contractSummarySchema,
  classification: "routine_write",
  scopes: ["legal:write"],
  idempotent: true,
  summary: "Issue a draft contract (assigns its number, locks the body).",
})

const contractsVoid = defineOperation({
  id: "legal.contracts.void",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/legal/contracts/${p.id}/void`,
  pathTemplate: "/v1/admin/legal/contracts/:id/void",
  input: z.object({}),
  output: contractSummarySchema,
  classification: "destructive",
  scopes: ["legal:write"],
  idempotent: true,
  summary: "Void a contract (irreversible).",
})

const policiesList = defineOperation({
  id: "legal.policies.list",
  method: "GET",
  path: () => "/v1/admin/legal/policies",
  pathTemplate: "/v1/admin/legal/policies",
  input: policiesListInputSchema,
  output: paginated(policySummarySchema),
  classification: "read",
  scopes: ["legal:read"],
  envelope: "raw",
  summary: "List legal policies with filters and offset pagination.",
})

const policiesGet = defineOperation({
  id: "legal.policies.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/legal/policies/${p.id}`,
  pathTemplate: "/v1/admin/legal/policies/:id",
  input: z.object({}),
  output: policySummarySchema,
  classification: "read",
  scopes: ["legal:read"],
  summary: "Get a single policy by id.",
})

const policiesCreate = defineOperation({
  id: "legal.policies.create",
  method: "POST",
  path: () => "/v1/admin/legal/policies",
  pathTemplate: "/v1/admin/legal/policies",
  input: insertPolicySchema,
  output: policySummarySchema,
  classification: "routine_write",
  scopes: ["legal:write"],
  idempotent: true,
  summary: "Create a policy.",
})

const policiesUpdate = defineOperation({
  id: "legal.policies.update",
  method: "PATCH",
  path: (p: { id: string }) => `/v1/admin/legal/policies/${p.id}`,
  pathTemplate: "/v1/admin/legal/policies/:id",
  input: updatePolicySchema,
  output: policySummarySchema,
  classification: "routine_write",
  scopes: ["legal:write"],
  summary: "Update a policy.",
})

const policiesEvaluate = defineOperation({
  id: "legal.policies.evaluate",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/legal/policies/${p.id}/evaluate`,
  pathTemplate: "/v1/admin/legal/policies/:id/evaluate",
  input: evaluateCancellationInputSchema,
  // Computation result — no fixed shape across policy kinds; kept loose.
  output: z.object({}).loose(),
  // Read-like, but POST — so an API-key caller needs the `write` action scope
  // (see `requireActor`'s method→action map).
  classification: "read",
  scopes: ["legal:write"],
  summary: "Evaluate a cancellation against a policy and return the outcome.",
})

export const legalOperations = {
  contracts: {
    list: contractsList,
    get: contractsGet,
    create: contractsCreate,
    update: contractsUpdate,
    issue: contractsIssue,
    void: contractsVoid,
  },
  policies: {
    list: policiesList,
    get: policiesGet,
    create: policiesCreate,
    update: policiesUpdate,
    evaluate: policiesEvaluate,
  },
} as const
