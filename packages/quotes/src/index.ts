import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { quotesLinkable } from "./linkables.js"
import type { QuotesRouteRuntimeOptions } from "./route-runtime.js"
import { createQuotesRoutes } from "./routes/index.js"

export { quoteLinkable, quotesLinkable, quoteVersionLinkable } from "./linkables.js"
export type { QuotesRoutes } from "./routes/index.js"

export const quotesModule: Module = {
  name: "quotes",
  linkable: quotesLinkable,
  requiresTransactionalDb: true,
}

export interface QuotesHonoModuleOptions extends QuotesRouteRuntimeOptions {}

export function createQuotesHonoModule(options: QuotesHonoModuleOptions = {}): HonoModule {
  return {
    module: quotesModule,
    adminRoutes: createQuotesRoutes(options),
  }
}

export const quotesHonoModule: HonoModule = createQuotesHonoModule()

export type { BookingQuoteDetail, NewBookingQuoteDetail } from "./booking-extension.js"
export {
  bookingQuoteDetails,
  bookingQuoteExtensionService,
  quotesBookingExtension,
} from "./booking-extension.js"
export type {
  AcceptPublicProposalResult,
  ApplyTripSnapshotToQuoteVersionResult,
  DeclinePublicProposalResult,
  PublicProposalFeedbackInput,
  PublicProposalFeedbackRecord,
  PublicQuoteVersionProposal,
  PublicQuoteVersionProposalLine,
  QuoteProposalRoutesOptions,
  QuoteVersionSnapshotRoutesOptions,
  RequestPublicProposalEditsResult,
  SendQuoteVersionResult,
} from "./proposal-routes.js"
export {
  buildQuoteVersionProposalUrl,
  createQuoteProposalAdminRoutes,
  createQuoteProposalPublicRoutes,
  createQuoteVersionSnapshotRoutes,
  tripSnapshotToQuoteVersionApply,
} from "./proposal-routes.js"
export type {
  QuotesRouteRuntime,
  QuotesRouteRuntimeOptions,
  ResolveQuoteParticipantPersonById,
} from "./route-runtime.js"
export type {
  NewPipeline,
  NewQuote,
  NewQuoteParticipant,
  NewQuoteProduct,
  NewQuoteVersion,
  NewQuoteVersionLine,
  NewStage,
  Pipeline,
  Quote,
  QuoteParticipant,
  QuoteProduct,
  QuoteVersion,
  QuoteVersionLine,
  Stage,
} from "./schema.js"
export {
  pipelines,
  quoteParticipants,
  quoteProducts,
  quoteStatusEnum,
  quotes,
  quoteVersionLines,
  quoteVersionStatusEnum,
  quoteVersions,
  stages,
} from "./schema.js"
export type { AcceptQuoteVersionResult } from "./service/index.js"
export {
  pipelinesService,
  QuoteVersionConflictError,
  quoteRecordsService,
  quotesService,
  quoteVersionsService,
} from "./service/index.js"
export {
  acceptQuoteVersionSchema,
  applyTripSnapshotQuoteVersionLineSchema,
  applyTripSnapshotToQuoteVersionSchema,
  declineQuoteVersionSchema,
  entityTypeSchema,
  expireQuoteVersionsSchema,
  insertPipelineSchema,
  insertQuoteParticipantSchema,
  insertQuoteProductSchema,
  insertQuoteSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  insertStageSchema,
  participantRoleSchema,
  pipelineListQuerySchema,
  quoteListQuerySchema,
  quoteStatusSchema,
  quoteVersionListQuerySchema,
  quoteVersionStatusSchema,
  sendQuoteVersionSchema,
  stageListQuerySchema,
  updatePipelineSchema,
  updateQuoteProductSchema,
  updateQuoteSchema,
  updateQuoteVersionLineSchema,
  updateQuoteVersionSchema,
  updateStageSchema,
} from "./validation.js"
