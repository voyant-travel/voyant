import type { LinkableDefinition, Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { quotesRoutes } from "./routes/index.js"

export type { QuotesRoutes } from "./routes/index.js"

export const quoteLinkable: LinkableDefinition = {
  module: "quotes",
  entity: "quote",
  table: "quotes",
  idPrefix: "quot",
}

export const quoteVersionLinkable: LinkableDefinition = {
  module: "quotes",
  entity: "quoteVersion",
  table: "quote_versions",
  idPrefix: "qver",
}

export const quotesModule: Module = {
  name: "quotes",
  linkable: {
    quote: quoteLinkable,
    quoteVersion: quoteVersionLinkable,
  },
  requiresTransactionalDb: true,
}

export function createQuotesHonoModule(): HonoModule {
  return {
    module: quotesModule,
    routes: quotesRoutes,
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
