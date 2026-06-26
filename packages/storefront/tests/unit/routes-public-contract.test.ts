import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  type CustomerPortalContactExistsResult,
  type CustomerPortalPhoneContactExistsResult,
  customerPortalContactExistsResultSchema,
  customerPortalPhoneContactExistsResultSchema,
} from "../../src/customer-portal/validation-public.js"

/**
 * Response contract tests (voyant#2114 — storefront public sub-batch) for the
 * customer-portal `contact-exists` legs converted to `@hono/zod-openapi`. Each
 * fixture is typed as the real `publicCustomerPortalService` return type so a
 * service-shape drift breaks compilation; the JSON round-trip mirrors `c.json`
 * so a declared/actual mismatch breaks the test. The schemas asserted here are
 * the exact ones declared as the `{ data }` response bodies in
 * `customer-portal/routes.ts`.
 */
function jsonRoundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

const contactExists: CustomerPortalContactExistsResult = {
  email: "traveller@example.com",
  authAccountExists: true,
  customerRecordExists: true,
  linkedCustomerRecordExists: false,
}

const phoneContactExists: CustomerPortalPhoneContactExistsResult = {
  phone: "+40712345678",
  authAccountExists: false,
  authAccountVerified: false,
  customerRecordExists: true,
  linkedCustomerRecordExists: false,
}

const cases: Array<{ name: string; value: unknown; schema: z.ZodTypeAny }> = [
  {
    name: "contact exists",
    value: contactExists,
    schema: customerPortalContactExistsResultSchema,
  },
  {
    name: "phone contact exists",
    value: phoneContactExists,
    schema: customerPortalPhoneContactExistsResultSchema,
  },
]

describe("storefront public response contracts", () => {
  for (const { name, value, schema } of cases) {
    it(`the ${name} { data } envelope satisfies the declared response schema`, () => {
      const wire = jsonRoundTrip({ data: value })
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})
