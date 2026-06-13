import { relations } from "drizzle-orm"

import {
  pipelines,
  quoteParticipants,
  quoteProducts,
  quotes,
  quoteVersionLines,
  quoteVersions,
  stages,
} from "./schema-sales.js"

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(stages),
  quotes: many(quotes),
}))

export const stagesRelations = relations(stages, ({ one, many }) => ({
  pipeline: one(pipelines, { fields: [stages.pipelineId], references: [pipelines.id] }),
  quotes: many(quotes),
}))

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [quotes.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(stages, { fields: [quotes.stageId], references: [stages.id] }),
  participants: many(quoteParticipants),
  products: many(quoteProducts),
  versions: many(quoteVersions),
}))

export const quoteParticipantsRelations = relations(quoteParticipants, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteParticipants.quoteId],
    references: [quotes.id],
  }),
}))

export const quoteProductsRelations = relations(quoteProducts, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteProducts.quoteId],
    references: [quotes.id],
  }),
}))

export const quoteVersionsRelations = relations(quoteVersions, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteVersions.quoteId],
    references: [quotes.id],
  }),
  supersedes: one(quoteVersions, {
    fields: [quoteVersions.supersedesId],
    references: [quoteVersions.id],
  }),
  lines: many(quoteVersionLines),
}))

export const quoteVersionLinesRelations = relations(quoteVersionLines, ({ one }) => ({
  quoteVersion: one(quoteVersions, {
    fields: [quoteVersionLines.quoteVersionId],
    references: [quoteVersions.id],
  }),
}))
