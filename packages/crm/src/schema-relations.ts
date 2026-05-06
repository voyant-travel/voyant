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
  opportunities,
  opportunityParticipants,
  opportunityProducts,
  pipelines,
  quoteLines,
  quotes,
  stages,
} from "./schema-sales.js"

export const organizationsRelations = relations(organizations, ({ many }) => ({
  people: many(people),
  opportunities: many(opportunities),
  notes: many(organizationNotes),
  communications: many(communicationLog),
}))

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  opportunities: many(opportunities),
  activityParticipants: many(activityParticipants),
  opportunityParticipants: many(opportunityParticipants),
  notes: many(personNotes),
  communications: many(communicationLog),
  segmentMemberships: many(segmentMembers),
}))

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(stages),
  opportunities: many(opportunities),
}))

export const stagesRelations = relations(stages, ({ one, many }) => ({
  pipeline: one(pipelines, { fields: [stages.pipelineId], references: [pipelines.id] }),
  opportunities: many(opportunities),
}))

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  person: one(people, { fields: [opportunities.personId], references: [people.id] }),
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  pipeline: one(pipelines, {
    fields: [opportunities.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(stages, { fields: [opportunities.stageId], references: [stages.id] }),
  participants: many(opportunityParticipants),
  products: many(opportunityProducts),
  quotes: many(quotes),
}))

export const opportunityParticipantsRelations = relations(opportunityParticipants, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityParticipants.opportunityId],
    references: [opportunities.id],
  }),
  person: one(people, {
    fields: [opportunityParticipants.personId],
    references: [people.id],
  }),
}))

export const opportunityProductsRelations = relations(opportunityProducts, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityProducts.opportunityId],
    references: [opportunities.id],
  }),
}))

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [quotes.opportunityId],
    references: [opportunities.id],
  }),
  lines: many(quoteLines),
}))

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLines.quoteId], references: [quotes.id] }),
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
