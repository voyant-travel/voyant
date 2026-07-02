import { z } from "zod"

/**
 * Response schemas for the MICE admin API (`/v1/admin/mice/*`). Records mirror
 * the fields the UI renders; zod strips unknown keys, so these stay lean.
 * List endpoints return `{ data, limit, offset }`; singles return `{ data }`.
 */
export const listEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), limit: z.number(), offset: z.number() })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

const nullableString = z.string().nullish()

// ── Program ──
export const programRecordSchema = z.object({
  id: z.string(),
  organizationId: nullableString,
  primaryContactPersonId: nullableString,
  accountManagerId: nullableString,
  name: z.string(),
  code: nullableString,
  type: z.string(),
  status: z.string(),
  destination: nullableString,
  startDate: nullableString,
  endDate: nullableString,
  estimatedPax: z.number().nullish(),
  confirmedPax: z.number().nullish(),
  currency: nullableString,
  budgetAmountCents: z.number().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ProgramRecord = z.infer<typeof programRecordSchema>
export const programListResponse = listEnvelope(programRecordSchema)
export const programSingleResponse = singleEnvelope(programRecordSchema)

// ── Session ──
export const sessionRecordSchema = z.object({
  id: z.string(),
  programId: z.string(),
  functionSpaceId: nullableString,
  title: z.string(),
  sessionType: z.string(),
  dayDate: nullableString,
  startsAt: nullableString,
  endsAt: nullableString,
  track: nullableString,
  capacity: z.number().nullish(),
  requiresRegistration: z.boolean(),
})
export type SessionRecord = z.infer<typeof sessionRecordSchema>
export const sessionListResponse = listEnvelope(sessionRecordSchema)
export const sessionSingleResponse = singleEnvelope(sessionRecordSchema)

// ── Delegate ──
export const delegateRecordSchema = z.object({
  id: z.string(),
  programId: z.string(),
  personId: nullableString,
  bookingId: nullableString,
  role: z.string(),
  status: z.string(),
  arrivalAt: nullableString,
  departureAt: nullableString,
})
export type DelegateRecord = z.infer<typeof delegateRecordSchema>
export const delegateListResponse = listEnvelope(delegateRecordSchema)
export const delegateSingleResponse = singleEnvelope(delegateRecordSchema)

// ── Session enrollment ──
export const enrollmentRecordSchema = z.object({
  id: z.string(),
  delegateId: z.string(),
  sessionId: z.string(),
  status: z.string(),
})
export type EnrollmentRecord = z.infer<typeof enrollmentRecordSchema>
export const enrollmentSingleResponse = singleEnvelope(enrollmentRecordSchema)

// ── Rooming ──
export const roomingAssignmentRecordSchema = z.object({
  id: z.string(),
  programId: z.string(),
  roomBlockId: nullableString,
  roomTypeId: nullableString,
  bedConfig: nullableString,
  sharingGroupId: nullableString,
  checkIn: nullableString,
  checkOut: nullableString,
})
export type RoomingAssignmentRecord = z.infer<typeof roomingAssignmentRecordSchema>
export const roomingListResponse = listEnvelope(roomingAssignmentRecordSchema)
export const roomingAssignmentDelegateRecordSchema = z.object({
  id: z.string(),
  roomingAssignmentId: z.string(),
  delegateId: z.string(),
  isPrimary: z.boolean(),
  bedLabel: nullableString,
})
export type RoomingAssignmentDelegateRecord = z.infer<typeof roomingAssignmentDelegateRecordSchema>
export const roomingAssignmentDetailSchema = roomingAssignmentRecordSchema.extend({
  delegates: z.array(roomingAssignmentDelegateRecordSchema),
})
export type RoomingAssignmentDetail = z.infer<typeof roomingAssignmentDetailSchema>
export const roomingSingleResponse = singleEnvelope(roomingAssignmentRecordSchema)
export const roomingDetailResponse = singleEnvelope(roomingAssignmentDetailSchema)
export const roomingDelegatesResponse = singleEnvelope(
  z.array(roomingAssignmentDelegateRecordSchema),
)

// ── Booking sidecar linkage ──
export const bookingMiceDetailRecordSchema = z.object({
  bookingId: z.string(),
  programId: nullableString,
  delegateId: nullableString,
})
export type BookingMiceDetailRecord = z.infer<typeof bookingMiceDetailRecordSchema>
export const bookingMiceDetailResponse = singleEnvelope(bookingMiceDetailRecordSchema.nullable())

// ── RFP + Bid ──
export const rfpRecordSchema = z.object({
  id: z.string(),
  programId: z.string(),
  title: z.string(),
  status: z.string(),
  issuedAt: nullableString,
  dueAt: nullableString,
})
export type RfpRecord = z.infer<typeof rfpRecordSchema>
export const rfpListResponse = listEnvelope(rfpRecordSchema)
export const rfpSingleResponse = singleEnvelope(rfpRecordSchema)

export const bidRecordSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: z.string(),
  totalCents: z.number().nullish(),
  currency: nullableString,
  validUntil: nullableString,
})
export type BidRecord = z.infer<typeof bidRecordSchema>
export const bidSingleResponse = singleEnvelope(bidRecordSchema)

export const invitationRecordSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: z.string(),
})
export type InvitationRecord = z.infer<typeof invitationRecordSchema>
export const invitationSingleResponse = singleEnvelope(invitationRecordSchema)

// GET /rfps/:id embeds the funnel: its invitations + bids (service `getRfp`).
export const rfpDetailSchema = rfpRecordSchema.extend({
  invitations: z.array(invitationRecordSchema),
  bids: z.array(bidRecordSchema),
})
export type RfpDetail = z.infer<typeof rfpDetailSchema>
export const rfpDetailResponse = singleEnvelope(rfpDetailSchema)

// POST /rfps/:id/award returns the awarded RFP + winning bid together.
export const awardResultSchema = z.object({ rfp: rfpRecordSchema, bid: bidRecordSchema })
export type AwardResult = z.infer<typeof awardResultSchema>
export const awardResponse = singleEnvelope(awardResultSchema)

// ── Cost sheet (per-currency P&L) ──
const costSheetCategorySchema = z.object({
  contractedCostCents: z.number(),
  pickedCostCents: z.number(),
  pickedSellCents: z.number(),
})
export const costSheetCurrencyTotalsSchema = z.object({
  currency: z.string(),
  roomBlocks: costSheetCategorySchema,
  spaceBlocks: costSheetCategorySchema,
  sessionInclusionsCostCents: z.number(),
  costCents: z.number(),
  sellCents: z.number(),
  marginCents: z.number(),
  marginPct: z.number().nullable(),
})
export type CostSheetCurrencyTotals = z.infer<typeof costSheetCurrencyTotalsSchema>
export const programCostSheetSchema = z.object({
  programId: z.string(),
  mixedCurrency: z.boolean(),
  byCurrency: z.array(costSheetCurrencyTotalsSchema),
})
export type ProgramCostSheet = z.infer<typeof programCostSheetSchema>
export const programCostSheetResponse = singleEnvelope(programCostSheetSchema)
