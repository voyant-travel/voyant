import { describe, expect, it } from "vitest"

import {
  activityListQuerySchema,
  communicationListQuerySchema,
  customFieldDefinitionListQuerySchema,
  insertCustomFieldDefinitionSchema,
  organizationListQuerySchema,
  personListQuerySchema,
  upsertCustomFieldValueSchema,
} from "../../src/validation.js"

describe("Custom field definition schemas", () => {
  const validDef = {
    entityType: "organization",
    key: "industry_code",
    label: "Industry Code",
    fieldType: "varchar",
  }

  it("requires entityType, key, label, fieldType", () => {
    const result = insertCustomFieldDefinitionSchema.parse(validDef)
    expect(result.entityType).toBe("organization")
    expect(result.key).toBe("industry_code")
    expect(result.isRequired).toBe(false)
    expect(result.isSearchable).toBe(false)
    expect(result.isExportable).toBe(true)
    expect(result.isInvoiceable).toBe(false)
  })

  it("rejects missing entityType", () => {
    expect(() =>
      insertCustomFieldDefinitionSchema.parse({
        key: "k",
        label: "L",
        fieldType: "varchar",
      }),
    ).toThrow()
  })

  it("accepts options array shape", () => {
    const result = insertCustomFieldDefinitionSchema.parse({
      ...validDef,
      fieldType: "enum",
      options: [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ],
    })
    expect(result.options).toHaveLength(2)
  })
})

describe("Custom field value upsert schema", () => {
  it("requires entityType and entityId", () => {
    const result = upsertCustomFieldValueSchema.parse({
      entityType: "organization",
      entityId: "crm_org_abc",
      textValue: "hello",
    })
    expect(result.entityType).toBe("organization")
    expect(result.entityId).toBe("crm_org_abc")
  })

  it("rejects missing entityType", () => {
    expect(() => upsertCustomFieldValueSchema.parse({ entityId: "crm_org_abc" })).toThrow()
  })

  it("rejects missing entityId", () => {
    expect(() => upsertCustomFieldValueSchema.parse({ entityType: "organization" })).toThrow()
  })
})

describe("Communication list query schema", () => {
  it("applies pagination defaults", () => {
    const result = communicationListQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it("accepts channel filter", () => {
    const result = communicationListQuerySchema.parse({ channel: "email" })
    expect(result.channel).toBe("email")
  })

  it("accepts direction filter", () => {
    const result = communicationListQuerySchema.parse({ direction: "inbound" })
    expect(result.direction).toBe("inbound")
  })

  it("accepts date range filters", () => {
    const result = communicationListQuerySchema.parse({
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
    })
    expect(result.dateFrom).toBe("2024-01-01")
    expect(result.dateTo).toBe("2024-12-31")
  })
})

describe("Pagination defaults", () => {
  it("applies default limit and offset", () => {
    const result = organizationListQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it("coerces string limit and offset", () => {
    const result = organizationListQuerySchema.parse({ limit: "25", offset: "10" })
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(10)
  })

  it("rejects negative limit", () => {
    expect(() => organizationListQuerySchema.parse({ limit: -1 })).toThrow()
  })

  it("rejects limit over 200", () => {
    expect(() => organizationListQuerySchema.parse({ limit: 201 })).toThrow()
  })

  it("rejects negative offset", () => {
    expect(() => organizationListQuerySchema.parse({ offset: -1 })).toThrow()
  })

  it("works for activity list query with filters", () => {
    const result = activityListQuerySchema.parse({
      type: "call",
      status: "planned",
    })
    expect(result.type).toBe("call")
    expect(result.status).toBe("planned")
    expect(result.limit).toBe(50)
  })

  it("works for custom field definition list query", () => {
    const result = customFieldDefinitionListQuerySchema.parse({
      entityType: "organization",
    })
    expect(result.entityType).toBe("organization")
    expect(result.limit).toBe(50)
  })
})

describe("Organization list query", () => {
  it("accepts relation filter", () => {
    const result = organizationListQuerySchema.parse({ relation: "client" })
    expect(result.relation).toBe("client")
  })

  it("accepts status filter", () => {
    const result = organizationListQuerySchema.parse({ status: "archived" })
    expect(result.status).toBe("archived")
  })

  it("accepts search filter", () => {
    const result = organizationListQuerySchema.parse({ search: "acme" })
    expect(result.search).toBe("acme")
  })

  it("accepts and trims taxId filter", () => {
    const result = organizationListQuerySchema.parse({ taxId: " RO44255073 " })
    expect(result.taxId).toBe("RO44255073")
  })

  it("accepts snake_case tax_id filter", () => {
    const result = organizationListQuerySchema.parse({ tax_id: "44255073" })
    expect(result.taxId).toBe("44255073")
  })

  it("accepts ownerId filter", () => {
    const result = organizationListQuerySchema.parse({ ownerId: "user_123" })
    expect(result.ownerId).toBe("user_123")
  })
})

describe("Person list query", () => {
  it("accepts relation filter", () => {
    const result = personListQuerySchema.parse({ relation: "supplier" })
    expect(result.relation).toBe("supplier")
  })

  it("accepts organizationId filter", () => {
    const result = personListQuerySchema.parse({ organizationId: "org_123" })
    expect(result.organizationId).toBe("org_123")
  })

  it("accepts search filter", () => {
    const result = personListQuerySchema.parse({ search: "john" })
    expect(result.search).toBe("john")
  })

  it("accepts combined filters", () => {
    const result = personListQuerySchema.parse({
      relation: "client",
      status: "active",
      search: "doe",
      limit: 10,
    })
    expect(result.relation).toBe("client")
    expect(result.status).toBe("active")
    expect(result.search).toBe("doe")
    expect(result.limit).toBe(10)
  })
})
