import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { sourceConnectionsAdminRoutes } from "./routes.js"

export const sourceConnectionsModule: Module = {
  name: "source-connections",
}

export const sourceConnectionsHonoModule: HonoModule = {
  module: sourceConnectionsModule,
  adminRoutes: sourceConnectionsAdminRoutes,
}

export type {
  SourceConnectionDetailResponse,
  SourceConnectionHealthResponse,
  SourceConnectionListResponse,
  SourceConnectionsAdminRoutes,
} from "./routes.js"
export { serializeSourceConnection, sourceConnectionsAdminRoutes } from "./routes.js"
export type {
  NewSourceConnection,
  SourceConnection,
  SourceConnectionCapabilityDeclaration,
  SourceConnectionCursorState,
  SourceConnectionHealthStatus,
  SourceConnectionMetadata,
  SourceConnectionRateLimitState,
  SourceConnectionStatus,
  SourceConnectionTruthMode,
} from "./schema.js"
export {
  sourceConnectionHealthStatusEnum,
  sourceConnectionStatusEnum,
  sourceConnections,
  sourceConnectionTruthModeEnum,
} from "./schema.js"
export {
  SourceConnectionLifecycleError,
  type SourceConnectionListResult,
  sourceConnectionsService,
} from "./service.js"
export type {
  CreateSourceConnectionDraftInput,
  DisconnectSourceConnectionInput,
  PauseSourceConnectionInput,
  ResumeSourceConnectionInput,
  SourceConnectionListQuery,
} from "./validation.js"
export {
  createSourceConnectionDraftSchema,
  disconnectSourceConnectionSchema,
  pauseSourceConnectionSchema,
  resumeSourceConnectionSchema,
  sourceConnectionCapabilityDeclarationSchema,
  sourceConnectionHealthStatusValues,
  sourceConnectionListQuerySchema,
  sourceConnectionStatusValues,
  sourceConnectionTruthModeValues,
} from "./validation.js"
