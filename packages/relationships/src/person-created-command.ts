import {
  type ActionLedgerRequestContextValues,
  executeAdmittedCreatedTargetCommand,
} from "@voyant-travel/action-ledger"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { RELATIONSHIPS_PERSON_CREATED_TARGET_POLICY as POLICY } from "./created-target-policy.js"
import { PERSON_CHANGED_EVENT } from "./events.js"
import type { CreatePersonInput } from "./service/accounts-shared.js"
import { relationshipsService } from "./service/index.js"

export interface PersonCreateCommandInput {
  person: CreatePersonInput
}

export async function executePersonCreateCommand(input: {
  db: PostgresJsDatabase
  context: ActionLedgerRequestContextValues
  commandInput: PersonCreateCommandInput
  admitted: ToolHandlerActionPolicyContext
  legacyIdempotencyKey?: string
  testHooks?: {
    /** Test-only failure/concurrency seam inside the handler-owned transaction. */
    afterDomainCreate?: (tx: PostgresJsDatabase, personId: string) => Promise<void>
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
        const person = await relationshipsService.createPerson(
          transaction,
          input.commandInput.person,
        )
        if (!person) {
          throw new TypeError("CRM person creation returned no row")
        }
        await input.testHooks?.afterDomainCreate?.(transaction, person.id)
        await insertOutboxEvents(transaction, [
          {
            name: PERSON_CHANGED_EVENT,
            data: { id: person.id, action: "created" },
            metadata: {
              category: "domain",
              source: "service",
              eventId: personCreatedEventId(person.id),
            },
          },
        ])
        return { value: { id: person.id }, targetId: person.id }
      },
      async replay(_tx, result) {
        return { id: result.reference.id }
      },
    },
  )
}

export function personCreatedEventId(personId: string): string {
  return `evt_relationships_person_created_${personId}`
}
