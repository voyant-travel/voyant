import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    agentId?: string
    workflowPrincipalId?: string
    principalSubtype?: string
    sessionId?: string
    apiTokenId?: string
    apiKeyId?: string
    callerType?: string
    actor?: string
    isInternalRequest?: boolean
    organizationId?: string
    workflowRunId?: string
    workflowStepId?: string
    eventBus?: EventBus
  }
}
