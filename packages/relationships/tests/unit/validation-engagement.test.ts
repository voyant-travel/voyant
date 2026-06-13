import { describe, expect, it } from "vitest"

import {
  communicationChannelSchema,
  communicationDirectionSchema,
  insertActivitySchema,
  insertCommunicationLogSchema,
  insertOrganizationNoteSchema,
  insertPersonNoteSchema,
  insertSegmentSchema,
} from "../../src/validation.js"

describe("Activity schemas", () => {
  it("requires subject and type", () => {
    const result = insertActivitySchema.parse({
      subject: "Follow-up call",
      type: "call",
    })
    expect(result.subject).toBe("Follow-up call")
    expect(result.type).toBe("call")
    expect(result.status).toBe("planned")
  })

  it("rejects missing type", () => {
    expect(() => insertActivitySchema.parse({ subject: "Follow-up" })).toThrow()
  })

  it("rejects invalid status enum", () => {
    expect(() =>
      insertActivitySchema.parse({
        subject: "Call",
        type: "call",
        status: "invalid",
      }),
    ).toThrow()
  })

  it("accepts datetime format for dueAt", () => {
    const result = insertActivitySchema.parse({
      subject: "Call",
      type: "call",
      dueAt: "2024-06-15T14:00:00Z",
    })
    expect(result.dueAt).toBe("2024-06-15T14:00:00Z")
  })

  it("rejects invalid dueAt format", () => {
    expect(() =>
      insertActivitySchema.parse({
        subject: "Call",
        type: "call",
        dueAt: "not-a-datetime",
      }),
    ).toThrow()
  })
})

describe("Person note schemas", () => {
  it("accepts valid content", () => {
    const result = insertPersonNoteSchema.parse({ content: "Called to follow up on proposal" })
    expect(result.content).toBe("Called to follow up on proposal")
  })

  it("rejects empty content", () => {
    expect(() => insertPersonNoteSchema.parse({ content: "" })).toThrow()
  })

  it("rejects content over 10000 chars", () => {
    expect(() => insertPersonNoteSchema.parse({ content: "x".repeat(10001) })).toThrow()
  })

  it("accepts content at max length", () => {
    const result = insertPersonNoteSchema.parse({ content: "x".repeat(10000) })
    expect(result.content).toHaveLength(10000)
  })
})

describe("Organization note schemas", () => {
  it("accepts valid content", () => {
    const result = insertOrganizationNoteSchema.parse({ content: "Updated payment terms" })
    expect(result.content).toBe("Updated payment terms")
  })

  it("rejects empty content", () => {
    expect(() => insertOrganizationNoteSchema.parse({ content: "" })).toThrow()
  })

  it("rejects content over 10000 chars", () => {
    expect(() => insertOrganizationNoteSchema.parse({ content: "x".repeat(10001) })).toThrow()
  })
})

describe("Communication log schemas", () => {
  it("accepts valid communication log entry", () => {
    const result = insertCommunicationLogSchema.parse({
      channel: "email",
      direction: "outbound",
      subject: "Follow-up email",
      content: "Sent pricing details",
    })
    expect(result.channel).toBe("email")
    expect(result.direction).toBe("outbound")
    expect(result.subject).toBe("Follow-up email")
    expect(result.content).toBe("Sent pricing details")
  })

  it("requires channel and direction", () => {
    expect(() => insertCommunicationLogSchema.parse({ direction: "inbound" })).toThrow()
    expect(() => insertCommunicationLogSchema.parse({ channel: "email" })).toThrow()
  })

  it("rejects invalid channel", () => {
    expect(() =>
      insertCommunicationLogSchema.parse({ channel: "telegram", direction: "inbound" }),
    ).toThrow()
  })

  it("rejects invalid direction", () => {
    expect(() =>
      insertCommunicationLogSchema.parse({ channel: "email", direction: "both" }),
    ).toThrow()
  })

  it("accepts all valid channels", () => {
    for (const channel of ["email", "phone", "whatsapp", "sms", "meeting", "other"]) {
      const result = insertCommunicationLogSchema.parse({ channel, direction: "inbound" })
      expect(result.channel).toBe(channel)
    }
  })

  it("accepts optional organizationId", () => {
    const result = insertCommunicationLogSchema.parse({
      channel: "phone",
      direction: "inbound",
      organizationId: "org_123",
    })
    expect(result.organizationId).toBe("org_123")
  })

  it("accepts optional sentAt timestamp", () => {
    const result = insertCommunicationLogSchema.parse({
      channel: "email",
      direction: "outbound",
      sentAt: "2024-06-15T14:00:00Z",
    })
    expect(result.sentAt).toBe("2024-06-15T14:00:00Z")
  })

  it("rejects subject over 500 chars", () => {
    expect(() =>
      insertCommunicationLogSchema.parse({
        channel: "email",
        direction: "outbound",
        subject: "x".repeat(501),
      }),
    ).toThrow()
  })
})

describe("Segment schemas", () => {
  it("accepts valid segment", () => {
    const result = insertSegmentSchema.parse({ name: "VIP Clients" })
    expect(result.name).toBe("VIP Clients")
  })

  it("rejects empty name", () => {
    expect(() => insertSegmentSchema.parse({ name: "" })).toThrow()
  })

  it("rejects name over 255 chars", () => {
    expect(() => insertSegmentSchema.parse({ name: "x".repeat(256) })).toThrow()
  })

  it("accepts optional description", () => {
    const result = insertSegmentSchema.parse({
      name: "VIP Clients",
      description: "Clients with annual spend > $100k",
    })
    expect(result.description).toBe("Clients with annual spend > $100k")
  })

  it("accepts optional conditions as JSON", () => {
    const result = insertSegmentSchema.parse({
      name: "Active",
      conditions: { status: "active", relation: "client" },
    })
    expect(result.conditions).toEqual({ status: "active", relation: "client" })
  })

  it("accepts null conditions", () => {
    const result = insertSegmentSchema.parse({ name: "All", conditions: null })
    expect(result.conditions).toBeNull()
  })
})

describe("Communication enum schemas", () => {
  it("channel schema accepts valid values", () => {
    for (const value of ["email", "phone", "whatsapp", "sms", "meeting", "other"]) {
      expect(communicationChannelSchema.parse(value)).toBe(value)
    }
  })

  it("channel schema rejects invalid value", () => {
    expect(() => communicationChannelSchema.parse("telegram")).toThrow()
  })

  it("direction schema accepts valid values", () => {
    for (const value of ["inbound", "outbound"]) {
      expect(communicationDirectionSchema.parse(value)).toBe(value)
    }
  })

  it("direction schema rejects invalid value", () => {
    expect(() => communicationDirectionSchema.parse("bidirectional")).toThrow()
  })
})
