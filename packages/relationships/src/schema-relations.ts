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

export const organizationsRelations = relations(organizations, ({ many }) => ({
  people: many(people),
  notes: many(organizationNotes),
  communications: many(communicationLog),
}))

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  activityParticipants: many(activityParticipants),
  notes: many(personNotes),
  communications: many(communicationLog),
  segmentMemberships: many(segmentMembers),
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
