import {
  type ActionLedgerRequestContextValues,
  type ExecuteAdmittedCreatedTargetCommandInput,
  type ExecuteCreatedTargetCommandHandlers,
  type ExecuteCreatedTargetCommandResult,
  executeAdmittedCreatedTargetCommand,
  mapActionLedgerRequestContext,
} from "@voyant-travel/action-ledger"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { QuotesCreatedTargetPolicy } from "./created-target-policy.js"

type QuotesCreatedCommandExecutor = (
  input: ExecuteAdmittedCreatedTargetCommandInput<string>,
  handlers: ExecuteCreatedTargetCommandHandlers<{ id: string }, string>,
) => Promise<ExecuteCreatedTargetCommandResult<{ id: string }, string>>

/**
 * Run a quote creation as a ledgered created-target command, so an exact retry
 * claims the original quote rather than opening a duplicate.
 */
export async function executeQuotesCreate(
  db: PostgresJsDatabase,
  context: ActionLedgerRequestContextValues,
  policy: QuotesCreatedTargetPolicy,
  commandInput: unknown,
  admitted: ToolHandlerActionPolicyContext,
  create: (tx: PostgresJsDatabase) => Promise<{ id: string }>,
  executor: QuotesCreatedCommandExecutor = executeAdmittedCreatedTargetCommand,
) {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new TypeError("Quote created-target commands require a concrete principal")
  }
  return executor(
    {
      db,
      context,
      admitted,
      commandTargetType: policy.commandTargetType,
      canonicalTargetType: policy.canonicalTargetType,
      resultReferenceType: policy.resultReferenceType,
      commandInput,
      evaluatedRisk: policy.evaluatedRisk,
    },
    {
      async create(tx) {
        const value = await create(tx as PostgresJsDatabase)
        return { value, targetId: value.id }
      },
    },
  )
}
