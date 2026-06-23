import { and, asc, eq, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { programs } from "./schema.js"
import {
  type Bid,
  type BidEvaluation,
  type BidLine,
  bidEvaluations,
  bidLines,
  bids,
  type Rfp,
  type RfpInvitation,
  rfpInvitations,
  rfps,
} from "./schema-rfp.js"
import type {
  AddBidEvaluationBody,
  CreateBidBody,
  CreateRfpBody,
  InviteSupplierBody,
  RfpListQuery,
  SetBidLinesBody,
  UpdateBidBody,
  UpdateRfpBody,
} from "./validation-rfp.js"

// ---------- RFP ----------

export type CreateRfpOutcome = { status: "ok"; rfp: Rfp } | { status: "program_not_found" }

function withRfpTimestamps<T extends { issuedAt?: string; dueAt?: string }>(input: T) {
  const { issuedAt, dueAt, ...rest } = input
  return {
    ...rest,
    ...(issuedAt !== undefined ? { issuedAt: new Date(issuedAt) } : {}),
    ...(dueAt !== undefined ? { dueAt: new Date(dueAt) } : {}),
  }
}

export async function createRfp(
  db: PostgresJsDatabase,
  input: CreateRfpBody,
): Promise<CreateRfpOutcome> {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, input.programId))
    .limit(1)
  if (!program) return { status: "program_not_found" }
  const [rfp] = await db.insert(rfps).values(withRfpTimestamps(input)).returning()
  if (!rfp) throw new Error("createRfp: insert returned no rows")
  return { status: "ok", rfp }
}

export async function getRfp(
  db: PostgresJsDatabase,
  id: string,
): Promise<(Rfp & { invitations: RfpInvitation[]; bids: Bid[] }) | null> {
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1)
  if (!rfp) return null
  const [invitations, rfpBids] = await Promise.all([
    db.select().from(rfpInvitations).where(eq(rfpInvitations.rfpId, id)),
    db.select().from(bids).where(eq(bids.rfpId, id)),
  ])
  return { ...rfp, invitations, bids: rfpBids }
}

export async function listRfps(
  db: PostgresJsDatabase,
  query: RfpListQuery,
): Promise<{ data: Rfp[]; limit: number; offset: number }> {
  const conditions = [eq(rfps.programId, query.programId)]
  if (query.status) conditions.push(eq(rfps.status, query.status))
  const data = await db
    .select()
    .from(rfps)
    .where(and(...conditions))
    .orderBy(asc(rfps.createdAt))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateRfp(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateRfpBody,
): Promise<Rfp | null> {
  const [rfp] = await db
    .update(rfps)
    .set({ ...withRfpTimestamps(input), updatedAt: new Date() })
    .where(eq(rfps.id, id))
    .returning()
  return rfp ?? null
}

export type InviteSupplierOutcome =
  | { status: "ok"; invitation: RfpInvitation; idempotent: boolean }
  | { status: "rfp_not_found" }

export async function inviteSupplier(
  db: PostgresJsDatabase,
  rfpId: string,
  input: InviteSupplierBody,
): Promise<InviteSupplierOutcome> {
  return db.transaction(async (tx) => {
    const [rfp] = await tx.select({ id: rfps.id }).from(rfps).where(eq(rfps.id, rfpId)).limit(1)
    if (!rfp) return { status: "rfp_not_found" as const }
    const [existing] = await tx
      .select()
      .from(rfpInvitations)
      .where(and(eq(rfpInvitations.rfpId, rfpId), eq(rfpInvitations.supplierId, input.supplierId)))
      .limit(1)
    if (existing) return { status: "ok" as const, invitation: existing, idempotent: true }
    const [invitation] = await tx
      .insert(rfpInvitations)
      .values({ rfpId, supplierId: input.supplierId })
      .returning()
    if (!invitation) throw new Error("inviteSupplier: insert returned no rows")
    return { status: "ok" as const, invitation, idempotent: false }
  })
}

// ---------- Bids ----------

export type CreateBidOutcome = { status: "ok"; bid: Bid } | { status: "rfp_not_found" }

export async function createBid(
  db: PostgresJsDatabase,
  rfpId: string,
  input: CreateBidBody,
): Promise<CreateBidOutcome> {
  const [rfp] = await db.select({ id: rfps.id }).from(rfps).where(eq(rfps.id, rfpId)).limit(1)
  if (!rfp) return { status: "rfp_not_found" }
  const { validUntil, ...rest } = input
  const [bid] = await db
    .insert(bids)
    .values({ rfpId, ...rest, ...(validUntil ? { validUntil: new Date(validUntil) } : {}) })
    .returning()
  if (!bid) throw new Error("createBid: insert returned no rows")
  return { status: "ok", bid }
}

export async function getBid(
  db: PostgresJsDatabase,
  id: string,
): Promise<(Bid & { lines: BidLine[]; evaluations: BidEvaluation[] }) | null> {
  const [bid] = await db.select().from(bids).where(eq(bids.id, id)).limit(1)
  if (!bid) return null
  const [lines, evaluations] = await Promise.all([
    db.select().from(bidLines).where(eq(bidLines.bidId, id)),
    db.select().from(bidEvaluations).where(eq(bidEvaluations.bidId, id)),
  ])
  return { ...bid, lines, evaluations }
}

export async function listBids(db: PostgresJsDatabase, rfpId: string): Promise<Bid[]> {
  return db.select().from(bids).where(eq(bids.rfpId, rfpId)).orderBy(asc(bids.createdAt))
}

export async function updateBid(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateBidBody,
): Promise<Bid | null> {
  const { validUntil, ...rest } = input
  const [bid] = await db
    .update(bids)
    .set({
      ...rest,
      ...(validUntil !== undefined ? { validUntil: new Date(validUntil) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bids.id, id))
    .returning()
  return bid ?? null
}

export type SetBidLinesOutcome = { status: "ok"; lines: BidLine[] } | { status: "bid_not_found" }

/** Replace a bid's line items (full replace). */
export async function setBidLines(
  db: PostgresJsDatabase,
  bidId: string,
  lines: SetBidLinesBody["lines"],
): Promise<SetBidLinesOutcome> {
  return db.transaction(async (tx) => {
    const [bid] = await tx.select({ id: bids.id }).from(bids).where(eq(bids.id, bidId)).limit(1)
    if (!bid) return { status: "bid_not_found" as const }
    await tx.delete(bidLines).where(eq(bidLines.bidId, bidId))
    if (lines.length === 0) return { status: "ok" as const, lines: [] }
    const rows = await tx
      .insert(bidLines)
      .values(lines.map((l) => ({ bidId, ...l })))
      .returning()
    return { status: "ok" as const, lines: rows }
  })
}

export type AddBidEvaluationOutcome =
  | { status: "ok"; evaluation: BidEvaluation }
  | { status: "bid_not_found" }

export async function addBidEvaluation(
  db: PostgresJsDatabase,
  bidId: string,
  input: AddBidEvaluationBody,
): Promise<AddBidEvaluationOutcome> {
  const [bid] = await db.select({ id: bids.id }).from(bids).where(eq(bids.id, bidId)).limit(1)
  if (!bid) return { status: "bid_not_found" }
  const [evaluation] = await db
    .insert(bidEvaluations)
    .values({ bidId, ...input })
    .returning()
  if (!evaluation) throw new Error("addBidEvaluation: insert returned no rows")
  return { status: "ok", evaluation }
}

// ---------- Award ----------

export type AwardRfpOutcome =
  | { status: "ok"; bid: Bid; rfp: Rfp }
  | { status: "rfp_not_found" }
  | { status: "bid_not_found" }
  | { status: "already_awarded" }

/**
 * Award an RFP to a bid: accept the winner, reject every other bid, and move
 * the RFP to `awarded` — all in one transaction. The downstream auto-spawn
 * (legal contract + provisional room block + booking) is a workflow subscriber
 * on the `mice.rfp.awarded` domain event, mounted operator-side (§9-Q6).
 */
export async function awardRfp(
  db: PostgresJsDatabase,
  rfpId: string,
  bidId: string,
): Promise<AwardRfpOutcome> {
  return db.transaction(async (tx) => {
    const [rfp] = await tx.select().from(rfps).where(eq(rfps.id, rfpId)).for("update").limit(1)
    if (!rfp) return { status: "rfp_not_found" as const }
    if (rfp.status === "awarded") return { status: "already_awarded" as const }

    const [winner] = await tx
      .select()
      .from(bids)
      .where(and(eq(bids.id, bidId), eq(bids.rfpId, rfpId)))
      .limit(1)
    if (!winner) return { status: "bid_not_found" as const }

    // Reject every other bid on this RFP.
    await tx
      .update(bids)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(bids.rfpId, rfpId), ne(bids.id, bidId)))

    const [acceptedBid] = await tx
      .update(bids)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(bids.id, bidId))
      .returning()
    const [awardedRfp] = await tx
      .update(rfps)
      .set({ status: "awarded", updatedAt: new Date() })
      .where(eq(rfps.id, rfpId))
      .returning()
    if (!acceptedBid || !awardedRfp) throw new Error("awardRfp: update returned no rows")
    return { status: "ok" as const, bid: acceptedBid, rfp: awardedRfp }
  })
}

export const rfpService = {
  createRfp,
  getRfp,
  listRfps,
  updateRfp,
  inviteSupplier,
  createBid,
  getBid,
  listBids,
  updateBid,
  setBidLines,
  addBidEvaluation,
  awardRfp,
}
