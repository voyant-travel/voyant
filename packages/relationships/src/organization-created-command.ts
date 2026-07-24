import {
  type ActionLedgerRequestContextValues,
  executeAdmittedCreatedTargetCommand,
} from "@voyant-travel/action-ledger"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { RELATIONSHIPS_ORGANIZATION_CREATED_TARGET_POLICY as POLICY } from "./created-target-policy.js"
import { ORGANIZATION_CHANGED_EVENT } from "./events.js"
import type {
  CreateAddressForEntityInput,
  CreateOrganizationInput,
} from "./service/accounts-shared.js"
import { relationshipsService } from "./service/index.js"

export interface OrganizationCreateCommandInput {
  organization: CreateOrganizationInput
  billingAddress: CreateAddressForEntityInput | null
}

export async function executeOrganizationCreateCommand(input: {
  db: PostgresJsDatabase
  context: ActionLedgerRequestContextValues
  commandInput: OrganizationCreateCommandInput
  admitted: ToolHandlerActionPolicyContext
  legacyIdempotencyKey?: string
  testHooks?: {
    /** Test-only failure/concurrency seam inside the handler-owned transaction. */
    afterDomainCreate?: (tx: PostgresJsDatabase, organizationId: string) => Promise<void>
  }
}) {
  return executeAdmittedCreatedTargetCommand(
    {
      db: input.db,
      context: input.context,
      admitted: input.admitted,
      idempotencyKey: input.legacyIdempotencyKey,
      commandTargetType: POLICY.commandTargetType,
      canonicalTargetType: POLICY.canonicalTargetType,
      resultReferenceType: POLICY.resultReferenceType,
      commandInput: input.commandInput,
      evaluatedRisk: POLICY.evaluatedRisk,
    },
    {
      async create(tx) {
        const transaction = tx as PostgresJsDatabase
        const organization = await relationshipsService.createOrganization(
          transaction,
          input.commandInput.organization,
        )
        if (!organization) {
          throw new TypeError("CRM organization creation returned no row")
        }
        if (input.commandInput.billingAddress) {
          const address = await relationshipsService.createAddress(
            transaction,
            "organization",
            organization.id,
            input.commandInput.billingAddress,
          )
          if (!address) {
            throw new TypeError("CRM billing address creation returned no row")
          }
        }
        await input.testHooks?.afterDomainCreate?.(transaction, organization.id)
        await insertOutboxEvents(transaction, [
          {
            name: ORGANIZATION_CHANGED_EVENT,
            data: { id: organization.id, action: "created" },
            metadata: {
              category: "domain",
              source: "service",
              eventId: organizationCreatedEventId(organization.id),
            },
          },
        ])
        return { value: { id: organization.id }, targetId: organization.id }
      },
      async replay(_tx, result) {
        return { id: result.reference.id }
      },
    },
  )
}

export function organizationCreatedEventId(organizationId: string): string {
  return `evt_relationships_organization_created_${organizationId}`
}
