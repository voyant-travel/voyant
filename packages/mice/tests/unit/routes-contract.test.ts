import type {
  bidEvaluations,
  bidLines,
  bids,
  delegateSessionEnrollments,
  programDelegates,
  programSessions,
  programs,
  rfpInvitations,
  rfps,
  roomingAssignmentDelegates,
  roomingAssignments,
  sessionInclusions,
} from "@voyant-travel/mice/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * Response contract tests (voyant#2114 — mice sub-batch) for the MICE admin
 * routes. Each Drizzle-backed fixture is typed as the real `$inferSelect` row so
 * column drift breaks compilation; the JSON round-trip (Date → ISO string)
 * mirrors `c.json` so a declared/actual mismatch breaks the test. The schemas
 * below mirror the response shapes declared in `routes.ts` (§17: date/timestamp
 * columns → strings; jsonb `metadata`/`requirements` are open records).
 *
 * MICE list services return `{ data, limit, offset }` (no `total` count read),
 * so the list envelope here omits `total`. The single-resource GET legs return
 * the base row extended with joined child collections (`inclusions`,
 * `enrollments`, `delegates`, `invitations`/`bids`, `lines`/`evaluations`);
 * those extended envelopes are asserted alongside the base `{ data }` shapes.
 */

const isoTimestamp = z.string()
const isoDate = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

/** MICE list envelope — `{ data, limit, offset }` (no `total`). */
const listEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const programSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  primaryContactPersonId: z.string().nullable(),
  accountManagerId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  destination: z.string().nullable(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  estimatedPax: z.number().int().nullable(),
  confirmedPax: z.number().int().nullable(),
  currency: z.string().nullable(),
  budgetAmountCents: z.number().int().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const sessionSchema = z.object({
  id: z.string(),
  programId: z.string(),
  functionSpaceId: z.string().nullable(),
  title: z.string(),
  sessionType: z.string(),
  dayDate: isoDate.nullable(),
  startsAt: isoTimestamp.nullable(),
  endsAt: isoTimestamp.nullable(),
  track: z.string().nullable(),
  capacity: z.number().int().nullable(),
  requiresRegistration: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const sessionInclusionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  quantity: z.number().int(),
  costAmountCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const delegateSchema = z.object({
  id: z.string(),
  programId: z.string(),
  personId: z.string().nullable(),
  bookingId: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  arrivalAt: isoTimestamp.nullable(),
  departureAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const enrollmentSchema = z.object({
  id: z.string(),
  delegateId: z.string(),
  sessionId: z.string(),
  status: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const roomingAssignmentSchema = z.object({
  id: z.string(),
  programId: z.string(),
  roomBlockId: z.string().nullable(),
  roomTypeId: z.string().nullable(),
  bedConfig: z.string().nullable(),
  sharingGroupId: z.string().nullable(),
  checkIn: isoDate.nullable(),
  checkOut: isoDate.nullable(),
  specialRequests: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const roomingAssignmentDelegateSchema = z.object({
  id: z.string(),
  roomingAssignmentId: z.string(),
  delegateId: z.string(),
  isPrimary: z.boolean(),
  bedLabel: z.string().nullable(),
  createdAt: isoTimestamp,
})

const rfpSchema = z.object({
  id: z.string(),
  programId: z.string(),
  title: z.string(),
  requirements: jsonRecord.nullable(),
  status: z.string(),
  issuedAt: isoTimestamp.nullable(),
  dueAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const rfpInvitationSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bidSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: z.string(),
  totalCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  proposalDoc: z.string().nullable(),
  validUntil: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bidLineSchema = z.object({
  id: z.string(),
  bidId: z.string(),
  requirementRef: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().int(),
  unitCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  createdAt: isoTimestamp,
})

const bidEvaluationSchema = z.object({
  id: z.string(),
  bidId: z.string(),
  criterion: z.string(),
  weight: z.number().int().nullable(),
  score: z.number().int().nullable(),
  notes: z.string().nullable(),
  evaluatedBy: z.string().nullable(),
  createdAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

// Drizzle-backed rows — typed so a column rename/retype breaks compilation.
const programRow: InferSelectModel<typeof programs> = {
  id: "mice_programs_0000000000000000000000000",
  organizationId: null,
  primaryContactPersonId: null,
  accountManagerId: "user-1",
  name: "Annual Sales Kickoff",
  code: "ASK-2026",
  type: "conference",
  status: "planning",
  destination: "Lisbon",
  startDate: "2026-09-01",
  endDate: "2026-09-04",
  estimatedPax: 200,
  confirmedPax: null,
  currency: "EUR",
  budgetAmountCents: 5_000_000,
  metadata: { region: "emea" },
  createdAt,
  updatedAt,
}

const sessionRow: InferSelectModel<typeof programSessions> = {
  id: "mice_program_sessions_000000000000000000",
  programId: programRow.id,
  functionSpaceId: null,
  title: "Opening Keynote",
  sessionType: "keynote",
  dayDate: "2026-09-01",
  startsAt: createdAt,
  endsAt: updatedAt,
  track: "main",
  capacity: 200,
  requiresRegistration: false,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const sessionInclusionRow: InferSelectModel<typeof sessionInclusions> = {
  id: "mice_session_inclusions_0000000000000000",
  sessionId: sessionRow.id,
  kind: "av",
  description: "PA + projector",
  quantity: 1,
  costAmountCents: 120_000,
  currency: "EUR",
  createdAt,
  updatedAt,
}

const delegateRow: InferSelectModel<typeof programDelegates> = {
  id: "mice_program_delegates_00000000000000000",
  programId: programRow.id,
  personId: null,
  bookingId: null,
  role: "attendee",
  status: "invited",
  arrivalAt: null,
  departureAt: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const enrollmentRow: InferSelectModel<typeof delegateSessionEnrollments> = {
  id: "mice_delegate_session_enrollments_000000",
  delegateId: delegateRow.id,
  sessionId: sessionRow.id,
  status: "registered",
  createdAt,
  updatedAt,
}

const roomingAssignmentRow: InferSelectModel<typeof roomingAssignments> = {
  id: "mice_rooming_assignments_000000000000000",
  programId: programRow.id,
  roomBlockId: null,
  roomTypeId: null,
  bedConfig: "twin",
  sharingGroupId: null,
  checkIn: "2026-09-01",
  checkOut: "2026-09-04",
  specialRequests: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const roomingAssignmentDelegateRow: InferSelectModel<typeof roomingAssignmentDelegates> = {
  id: "mice_rooming_assignment_delegates_000000",
  roomingAssignmentId: roomingAssignmentRow.id,
  delegateId: delegateRow.id,
  isPrimary: true,
  bedLabel: "A",
  createdAt,
}

const rfpRow: InferSelectModel<typeof rfps> = {
  id: "mice_rfps_0000000000000000000000000000",
  programId: programRow.id,
  title: "Venue & Catering RFP",
  requirements: { rooms: 100 },
  status: "issued",
  issuedAt: createdAt,
  dueAt: updatedAt,
  notes: null,
  createdAt,
  updatedAt,
}

const rfpInvitationRow: InferSelectModel<typeof rfpInvitations> = {
  id: "mice_rfp_invitations_0000000000000000000",
  rfpId: rfpRow.id,
  supplierId: "sup_0000000000000000000000000",
  status: "invited",
  createdAt,
  updatedAt,
}

const bidRow: InferSelectModel<typeof bids> = {
  id: "mice_bids_0000000000000000000000000000",
  rfpId: rfpRow.id,
  supplierId: "sup_0000000000000000000000000",
  status: "submitted",
  totalCents: 2_500_000,
  currency: "EUR",
  proposalDoc: null,
  validUntil: updatedAt,
  notes: null,
  createdAt,
  updatedAt,
}

const bidLineRow: InferSelectModel<typeof bidLines> = {
  id: "mice_bid_lines_000000000000000000000000",
  bidId: bidRow.id,
  requirementRef: "rooms",
  description: "100 twin rooms",
  quantity: 100,
  unitCents: 20_000,
  totalCents: 2_000_000,
  createdAt,
}

const bidEvaluationRow: InferSelectModel<typeof bidEvaluations> = {
  id: "mice_bid_evaluations_0000000000000000000",
  bidId: bidRow.id,
  criterion: "price",
  weight: 40,
  score: 8,
  notes: null,
  evaluatedBy: "user-1",
  createdAt,
}

const pagination = { limit: 50, offset: 0 } as const

const cases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "program", row: programRow, schema: programSchema },
  { name: "session", row: sessionRow, schema: sessionSchema },
  { name: "session inclusion", row: sessionInclusionRow, schema: sessionInclusionSchema },
  { name: "delegate", row: delegateRow, schema: delegateSchema },
  { name: "enrollment", row: enrollmentRow, schema: enrollmentSchema },
  { name: "rooming assignment", row: roomingAssignmentRow, schema: roomingAssignmentSchema },
  {
    name: "rooming assignment delegate",
    row: roomingAssignmentDelegateRow,
    schema: roomingAssignmentDelegateSchema,
  },
  { name: "rfp", row: rfpRow, schema: rfpSchema },
  { name: "rfp invitation", row: rfpInvitationRow, schema: rfpInvitationSchema },
  { name: "bid", row: bidRow, schema: bidSchema },
  { name: "bid line", row: bidLineRow, schema: bidLineSchema },
  { name: "bid evaluation", row: bidEvaluationRow, schema: bidEvaluationSchema },
]

describe("mice Drizzle-backed response contracts", () => {
  for (const { name, row, schema } of cases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  // Lists are exposed for the program-scoped resources only.
  const listCases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
    { name: "program", row: programRow, schema: programSchema },
    { name: "session", row: sessionRow, schema: sessionSchema },
    { name: "delegate", row: delegateRow, schema: delegateSchema },
    { name: "rooming assignment", row: roomingAssignmentRow, schema: roomingAssignmentSchema },
    { name: "rfp", row: rfpRow, schema: rfpSchema },
  ]

  for (const { name, row, schema } of listCases) {
    it(`the ${name} list envelope satisfies the declared { data, limit, offset } schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = listEnvelope(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the session { data } envelope carries its joined inclusions", () => {
    const wire = JSON.parse(
      JSON.stringify({ data: { ...sessionRow, inclusions: [sessionInclusionRow] } }),
    )
    const parsed = z
      .object({ data: sessionSchema.extend({ inclusions: z.array(sessionInclusionSchema) }) })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delegate { data } envelope carries its joined enrollments", () => {
    const wire = JSON.parse(
      JSON.stringify({ data: { ...delegateRow, enrollments: [enrollmentRow] } }),
    )
    const parsed = z
      .object({ data: delegateSchema.extend({ enrollments: z.array(enrollmentSchema) }) })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the rooming assignment { data } envelope carries its joined delegates", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: { ...roomingAssignmentRow, delegates: [roomingAssignmentDelegateRow] },
      }),
    )
    const parsed = z
      .object({
        data: roomingAssignmentSchema.extend({
          delegates: z.array(roomingAssignmentDelegateSchema),
        }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the rfp { data } envelope carries its joined invitations and bids", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: { ...rfpRow, invitations: [rfpInvitationRow], bids: [bidRow] },
      }),
    )
    const parsed = z
      .object({
        data: rfpSchema.extend({
          invitations: z.array(rfpInvitationSchema),
          bids: z.array(bidSchema),
        }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the bid { data } envelope carries its joined lines and evaluations", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: { ...bidRow, lines: [bidLineRow], evaluations: [bidEvaluationRow] },
      }),
    )
    const parsed = z
      .object({
        data: bidSchema.extend({
          lines: z.array(bidLineSchema),
          evaluations: z.array(bidEvaluationSchema),
        }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
