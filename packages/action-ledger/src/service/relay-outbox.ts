import type { ActionLedgerRelayOutbox } from "../schema.js"
import { parseCursorDate } from "./cursors.js"

export type ActionLedgerRelayOutboxSqlRow = {
  id: string
  action_id: string
  organization_id: string | null
  relay_status: ActionLedgerRelayOutbox["relayStatus"]
  payload_ref: string | null
  attempt_count: number | string
  next_retry_at: Date | string | null
  last_error: string | null
  created_at: Date | string
  processed_at: Date | string | null
}

export function actionLedgerRelayOutboxFromSqlRow(
  row: ActionLedgerRelayOutboxSqlRow,
): ActionLedgerRelayOutbox {
  return {
    id: row.id,
    actionId: row.action_id,
    organizationId: row.organization_id,
    relayStatus: row.relay_status,
    payloadRef: row.payload_ref,
    attemptCount: Number(row.attempt_count),
    nextRetryAt: row.next_retry_at ? parseCursorDate(row.next_retry_at) : null,
    lastError: row.last_error,
    createdAt: parseCursorDate(row.created_at),
    processedAt: row.processed_at ? parseCursorDate(row.processed_at) : null,
  }
}
