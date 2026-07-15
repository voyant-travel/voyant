import { describe, expect, it } from "vitest"

import { __test__ } from "../../src/routes.js"
import {
  makeApproval,
  makeDelegation,
  makeEntry,
  makeMutationDetail,
  makePayload,
  makeSensitiveReadDetail,
} from "./routes-fixtures.js"

/**
 * Contract tests for the action-ledger admin wire shapes (voyant#2114 /
 * voyant#2208). The handlers serialize Drizzle rows whose `timestamp` columns
 * are `Date`s; the serializers + `c.json(...)` turn them into ISO strings on
 * the wire. These tests assert the authored OpenAPI response schemas match the
 * serialized wire form (§17 Date→string), via a JSON round-trip.
 */

const {
  actionApprovalSchema,
  actionDelegationSchema,
  actionLedgerEntryDetailSchema,
  actionLedgerEntrySchema,
  serializeActionApproval,
  serializeActionDelegation,
  serializeActionLedgerEntry,
  serializeActionLedgerEntryDetail,
} = __test__

/** Reproduce the wire form: JSON serialize then re-parse (Date → ISO string). */
function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe("action-ledger admin contract", () => {
  it("entry row schema accepts a serialized ledger entry (§17 dates→strings)", () => {
    const parsed = actionLedgerEntrySchema.parse(toWire(serializeActionLedgerEntry(makeEntry())))
    expect(parsed.id).toBe("alge_1")
    expect(typeof parsed.occurredAt).toBe("string")
    expect(parsed.occurredAt).toBe("2026-05-15T10:00:00.000Z")
    expect(parsed.createdAt).toBe("2026-05-15T10:00:00.000Z")
  })

  it("entry detail schema accepts mutation/sensitive details and payloads", () => {
    const wire = toWire(
      serializeActionLedgerEntryDetail({
        entry: makeEntry(),
        mutationDetail: makeMutationDetail(),
        sensitiveReadDetail: makeSensitiveReadDetail(),
        payloads: [makePayload()],
      }),
    )
    const parsed = actionLedgerEntryDetailSchema.parse(wire)
    expect(parsed.mutationDetail?.reversalKind).toBe("none")
    expect(parsed.sensitiveReadDetail?.disclosedFieldSet).toEqual(["passportNumber"])
    expect(parsed.payloads[0]?.expiresAt).toBe("2026-06-15T10:00:00.000Z")
  })

  it("entry detail schema accepts null details and empty collections", () => {
    const wire = toWire(
      serializeActionLedgerEntryDetail({
        entry: makeEntry(),
        mutationDetail: null,
        sensitiveReadDetail: null,
        payloads: [],
      }),
    )
    const parsed = actionLedgerEntryDetailSchema.parse(wire)
    expect(parsed.mutationDetail).toBeNull()
    expect(parsed.sensitiveReadDetail).toBeNull()
    expect(parsed.payloads).toHaveLength(0)
  })

  it("approval row schema accepts a serialized approval (nullable decidedAt/expiresAt)", () => {
    const parsed = actionApprovalSchema.parse(toWire(serializeActionApproval(makeApproval())))
    expect(parsed.status).toBe("pending")
    expect(parsed.riskSnapshot).toBe("high")
    expect(parsed.expiresAt).toBe("2026-05-15T12:00:00.000Z")
    expect(parsed.decidedAt).toBeNull()
  })

  it("delegation row schema accepts a serialized delegation", () => {
    const parsed = actionDelegationSchema.parse(toWire(serializeActionDelegation(makeDelegation())))
    expect(parsed.childPrincipalType).toBe("agent")
    expect(parsed.expiresAt).toBe("2026-05-15T12:00:00.000Z")
  })
})
