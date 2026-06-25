import type {
  resourceCloseouts,
  resourcePoolMembers,
  resourcePools,
  resourceRequirements,
  resourceSlotAssignments,
  resources,
} from "@voyant-travel/operations/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * Response contract tests (voyant#2114 — final operations sub-batch) for the
 * resources admin routes. Each Drizzle-backed fixture is typed as the real
 * `$inferSelect` row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `resources/routes.ts` (§17: timestamps/dates → strings). No resources list
 * endpoint joins another table, so list rows carry no extra columns beyond the
 * base `$inferSelect` shape; each list is therefore asserted against the shared
 * `{ data, total, limit, offset }` envelope using the same row schema as the
 * single `{ data }` get/create/update responses.
 */

const isoTimestamp = z.string()
const kindSchema = z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"])
const allocationModeSchema = z.enum(["shared", "exclusive"])
const assignmentStatusSchema = z.enum([
  "reserved",
  "assigned",
  "released",
  "cancelled",
  "completed",
])

const listEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const resourceSchema = z.object({
  id: z.string(),
  supplierId: z.string().nullable(),
  facilityId: z.string().nullable(),
  kind: kindSchema,
  name: z.string(),
  code: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const poolSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  kind: kindSchema,
  name: z.string(),
  sharedCapacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const poolMemberSchema = z.object({
  id: z.string(),
  poolId: z.string(),
  resourceId: z.string(),
  createdAt: isoTimestamp,
})

const requirementSchema = z.object({
  id: z.string(),
  poolId: z.string(),
  productId: z.string(),
  availabilityRuleId: z.string().nullable(),
  startTimeId: z.string().nullable(),
  quantityRequired: z.number().int(),
  allocationMode: allocationModeSchema,
  priority: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const slotAssignmentSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  poolId: z.string().nullable(),
  resourceId: z.string().nullable(),
  bookingId: z.string().nullable(),
  status: assignmentStatusSchema,
  assignedAt: isoTimestamp,
  assignedBy: z.string().nullable(),
  releasedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
})

const closeoutSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  dateLocal: z.string(),
  startsAt: isoTimestamp.nullable(),
  endsAt: isoTimestamp.nullable(),
  reason: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

// Drizzle-backed rows — typed so a column rename/retype breaks compilation.
const resourceRow: InferSelectModel<typeof resources> = {
  id: "resources_00000000000000000000000000",
  supplierId: null,
  facilityId: null,
  kind: "guide",
  name: "Senior City Guide",
  code: "GUIDE-1",
  capacity: 1,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const poolRow: InferSelectModel<typeof resourcePools> = {
  id: "resource_pools_000000000000000000000000",
  productId: null,
  kind: "guide",
  name: "City Guides Pool",
  sharedCapacity: 5,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const poolMemberRow: InferSelectModel<typeof resourcePoolMembers> = {
  id: "resource_pool_members_00000000000000000",
  poolId: poolRow.id,
  resourceId: resourceRow.id,
  createdAt,
}

const requirementRow: InferSelectModel<typeof resourceRequirements> = {
  id: "resource_requirements_00000000000000000",
  poolId: poolRow.id,
  productId: "products_00000000000000000000000000",
  availabilityRuleId: null,
  startTimeId: null,
  quantityRequired: 2,
  allocationMode: "shared",
  priority: 0,
  createdAt,
  updatedAt,
}

const slotAssignmentRow: InferSelectModel<typeof resourceSlotAssignments> = {
  id: "resource_slot_assignments_00000000000000",
  slotId: "availability_slots_00000000000000000000",
  poolId: poolRow.id,
  resourceId: resourceRow.id,
  bookingId: null,
  status: "reserved",
  assignedAt: createdAt,
  assignedBy: null,
  releasedAt: null,
  notes: null,
}

const closeoutRow: InferSelectModel<typeof resourceCloseouts> = {
  id: "resource_closeouts_00000000000000000000",
  resourceId: resourceRow.id,
  dateLocal: "2026-07-04",
  startsAt: null,
  endsAt: null,
  reason: "Maintenance",
  createdBy: null,
  createdAt,
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

const cases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "resource", row: resourceRow, schema: resourceSchema },
  { name: "pool", row: poolRow, schema: poolSchema },
  { name: "pool member", row: poolMemberRow, schema: poolMemberSchema },
  // `requirement` doubles as the `allocation` alias surface (same row shape).
  { name: "requirement", row: requirementRow, schema: requirementSchema },
  { name: "slot assignment", row: slotAssignmentRow, schema: slotAssignmentSchema },
  { name: "closeout", row: closeoutRow, schema: closeoutSchema },
]

describe("resources Drizzle-backed response contracts", () => {
  for (const { name, row, schema } of cases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })

    it(`the ${name} list envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = listEnvelope(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the delete envelope satisfies the declared schema", () => {
    const parsed = z.object({ success: z.literal(true) }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })

  it("the batch-update envelope satisfies the declared schema", () => {
    const parsed = z
      .object({
        data: z.array(resourceSchema),
        total: z.number().int(),
        succeeded: z.number().int(),
        failed: z.array(z.object({ id: z.string(), error: z.string() })),
      })
      .safeParse({
        data: JSON.parse(JSON.stringify([resourceRow])),
        total: 2,
        succeeded: 1,
        failed: [{ id: "resources_missing", error: "Not found" }],
      })
    expect(parsed.success ? null : parsed.error?.toString()).toBeNull()
  })

  it("the batch-delete envelope satisfies the declared schema", () => {
    const parsed = z
      .object({
        deletedIds: z.array(z.string()),
        total: z.number().int(),
        succeeded: z.number().int(),
        failed: z.array(z.object({ id: z.string(), error: z.string() })),
      })
      .safeParse({
        deletedIds: [resourceRow.id],
        total: 2,
        succeeded: 1,
        failed: [{ id: "resources_missing", error: "Not found" }],
      })
    expect(parsed.success ? null : parsed.error?.toString()).toBeNull()
  })
})
