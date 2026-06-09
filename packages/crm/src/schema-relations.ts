import { relations } from "drizzle-orm"

import {
  communicationLog,
  organizationNotes,
  organizations,
  people,
  personNotes,
  segmentMembers,
  segments,
} from "./schema-accounts.js"
import {
  activities,
  activityLinks,
  activityParticipants,
  customFieldDefinitions,
  customFieldValues,
} from "./schema-activities.js"
import {
  pipelines,
  quoteParticipants,
  quoteProducts,
  quotes,
  quoteVersionLines,
  quoteVersions,
  stages,
} from "./schema-sales.js"

export const organizationsRelations = relations(organizations, ({ many }) => ({
  people: many(people),
  quotes: many(quotes),
  notes: many(organizationNotes),
  communications: many(communicationLog),
}))

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  quotes: many(quotes),
  activityParticipants: many(activityParticipants),
  quoteParticipants: many(quoteParticipants),
  notes: many(personNotes),
  communications: many(communicationLog),
  segmentMemberships: many(segmentMembers),
}))

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(stages),
  quotes: many(quotes),
}))

export const stagesRelations = relations(stages, ({ one, many }) => ({
  pipeline: one(pipelines, { fields: [stages.pipelineId], references: [pipelines.id] }),
  quotes: many(quotes),
}))

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  person: one(people, { fields: [quotes.personId], references: [people.id] }),
  organization: one(organizations, {
    fields: [quotes.organizationId],
    references: [organizations.id],
  }),
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
  person: one(people, {
    fields: [quoteParticipants.personId],
    references: [people.id],
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

export const activitiesRelations = relations(activities, ({ many }) => ({
  links: many(activityLinks),
  participants: many(activityParticipants),
}))

export const activityLinksRelations = relations(activityLinks, ({ one }) => ({
  activity: one(activities, {
    fields: [activityLinks.activityId],
    references: [activities.id],
  }),
}))

export const activityParticipantsRelations = relations(activityParticipants, ({ one }) => ({
  activity: one(activities, {
    fields: [activityParticipants.activityId],
    references: [activities.id],
  }),
  person: one(people, {
    fields: [activityParticipants.personId],
    references: [people.id],
  }),
}))

export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ many }) => ({
  values: many(customFieldValues),
}))

export const customFieldValuesRelations = relations(customFieldValues, ({ one }) => ({
  definition: one(customFieldDefinitions, {
    fields: [customFieldValues.definitionId],
    references: [customFieldDefinitions.id],
  }),
}))

export const personNotesRelations = relations(personNotes, ({ one }) => ({
  person: one(people, { fields: [personNotes.personId], references: [people.id] }),
}))

export const organizationNotesRelations = relations(organizationNotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationNotes.organizationId],
    references: [organizations.id],
  }),
}))

export const communicationLogRelations = relations(communicationLog, ({ one }) => ({
  person: one(people, { fields: [communicationLog.personId], references: [people.id] }),
  organization: one(organizations, {
    fields: [communicationLog.organizationId],
    references: [organizations.id],
  }),
}))

export const segmentsRelations = relations(segments, ({ many }) => ({
  members: many(segmentMembers),
}))

export const segmentMembersRelations = relations(segmentMembers, ({ one }) => ({
  segment: one(segments, { fields: [segmentMembers.segmentId], references: [segments.id] }),
  person: one(people, { fields: [segmentMembers.personId], references: [people.id] }),
}))
