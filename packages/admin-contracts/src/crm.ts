/**
 * CRM admin operations: people + organizations CRUD, plus the PII-gated
 * person-document reveal.
 *
 * Input schemas derive from `@voyantjs/crm-contracts` (the canonical route
 * validation) so the SDK can't drift from the routes. Output schemas stay loose
 * client-facing projections (ADR-0003): unknown server fields are stripped, not
 * rejected, so the contract is forward-compatible.
 */

import {
  insertOrganizationSchema,
  insertPersonSchema,
  updateOrganizationSchema,
  updatePersonSchema,
} from "@voyantjs/crm-contracts"
import { z } from "zod"

import { defineOperation } from "./core/operation.js"
import { pageQuerySchema, paginated } from "./core/pagination.js"

export const personSummarySchema = z.object({
  id: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type PersonSummary = z.infer<typeof personSummarySchema>

export const organizationSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>

// Delete/ack response. Kept deliberately loose: a delete route may return
// `{ success: true }` or the removed entity; we only assert it parses as an
// object (extra keys are stripped).
const ackSchema = z.object({ success: z.boolean().optional(), id: z.string().optional() })

export const crmPeopleListInputSchema = pageQuerySchema.extend({
  search: z.string().optional(),
  organizationId: z.string().optional(),
})

export const crmOrganizationsListInputSchema = pageQuerySchema.extend({
  search: z.string().optional(),
})

const peopleList = defineOperation({
  id: "crm.people.list",
  method: "GET",
  path: () => "/v1/admin/crm/people",
  pathTemplate: "/v1/admin/crm/people",
  input: crmPeopleListInputSchema,
  output: paginated(personSummarySchema),
  classification: "read",
  scopes: ["crm:read"],
  envelope: "raw",
  summary: "List CRM people with filters and offset pagination.",
})

const peopleGet = defineOperation({
  id: "crm.people.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/crm/people/${p.id}`,
  pathTemplate: "/v1/admin/crm/people/:id",
  input: z.object({}),
  output: personSummarySchema,
  classification: "read",
  scopes: ["crm:read"],
  summary: "Get a single CRM person by id.",
})

const peopleCreate = defineOperation({
  id: "crm.people.create",
  method: "POST",
  path: () => "/v1/admin/crm/people",
  pathTemplate: "/v1/admin/crm/people",
  input: insertPersonSchema,
  output: personSummarySchema,
  classification: "routine_write",
  scopes: ["crm:write"],
  idempotent: true,
  summary: "Create a CRM person.",
})

const peopleUpdate = defineOperation({
  id: "crm.people.update",
  method: "PATCH",
  path: (p: { id: string }) => `/v1/admin/crm/people/${p.id}`,
  pathTemplate: "/v1/admin/crm/people/:id",
  input: updatePersonSchema,
  output: personSummarySchema,
  classification: "routine_write",
  scopes: ["crm:write"],
  summary: "Update a CRM person.",
})

const peopleDelete = defineOperation({
  id: "crm.people.delete",
  method: "DELETE",
  path: (p: { id: string }) => `/v1/admin/crm/people/${p.id}`,
  pathTemplate: "/v1/admin/crm/people/:id",
  input: z.object({}),
  output: ackSchema,
  // DELETE callers need the `delete` action scope (see `requireActor`'s
  // method→action map), not `write`.
  classification: "destructive",
  scopes: ["crm:delete"],
  summary: "Delete a CRM person.",
})

const peopleRevealDocument = defineOperation({
  id: "crm.people.documents.reveal",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/crm/person-documents/${p.id}/reveal`,
  pathTemplate: "/v1/admin/crm/person-documents/:id/reveal",
  input: z.object({}),
  output: z.object({
    documentNumber: z.string().optional(),
    value: z.string().optional(),
  }),
  classification: "read",
  // Needs the ordinary read scope AND the PII grant; gated by an action-ledger
  // capability server-side.
  scopes: ["crm:read", "crm-pii:read"],
  capabilityKey: "crm-pii:read:person-document",
  summary: "Reveal a person document's encrypted number (PII-gated).",
})

const orgList = defineOperation({
  id: "crm.organizations.list",
  method: "GET",
  path: () => "/v1/admin/crm/organizations",
  pathTemplate: "/v1/admin/crm/organizations",
  input: crmOrganizationsListInputSchema,
  output: paginated(organizationSummarySchema),
  classification: "read",
  scopes: ["crm:read"],
  envelope: "raw",
  summary: "List CRM organizations with filters and offset pagination.",
})

const orgGet = defineOperation({
  id: "crm.organizations.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/crm/organizations/${p.id}`,
  pathTemplate: "/v1/admin/crm/organizations/:id",
  input: z.object({}),
  output: organizationSummarySchema,
  classification: "read",
  scopes: ["crm:read"],
  summary: "Get a single CRM organization by id.",
})

const orgCreate = defineOperation({
  id: "crm.organizations.create",
  method: "POST",
  path: () => "/v1/admin/crm/organizations",
  pathTemplate: "/v1/admin/crm/organizations",
  input: insertOrganizationSchema,
  output: organizationSummarySchema,
  classification: "routine_write",
  scopes: ["crm:write"],
  idempotent: true,
  summary: "Create a CRM organization.",
})

const orgUpdate = defineOperation({
  id: "crm.organizations.update",
  method: "PATCH",
  path: (p: { id: string }) => `/v1/admin/crm/organizations/${p.id}`,
  pathTemplate: "/v1/admin/crm/organizations/:id",
  input: updateOrganizationSchema,
  output: organizationSummarySchema,
  classification: "routine_write",
  scopes: ["crm:write"],
  summary: "Update a CRM organization.",
})

const orgDelete = defineOperation({
  id: "crm.organizations.delete",
  method: "DELETE",
  path: (p: { id: string }) => `/v1/admin/crm/organizations/${p.id}`,
  pathTemplate: "/v1/admin/crm/organizations/:id",
  input: z.object({}),
  output: ackSchema,
  classification: "destructive",
  scopes: ["crm:delete"],
  summary: "Delete a CRM organization.",
})

export const crmOperations = {
  people: {
    list: peopleList,
    get: peopleGet,
    create: peopleCreate,
    update: peopleUpdate,
    delete: peopleDelete,
    revealDocument: peopleRevealDocument,
  },
  organizations: {
    list: orgList,
    get: orgGet,
    create: orgCreate,
    update: orgUpdate,
    delete: orgDelete,
  },
} as const
