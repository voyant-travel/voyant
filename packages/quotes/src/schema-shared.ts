import { pgEnum } from "drizzle-orm/pg-core"

export const entityTypeEnum = pgEnum("entity_type", ["organization", "person", "quote", "activity"])

export const quoteStatusEnum = pgEnum("quote_status", ["open", "won", "lost", "archived"])

export const quoteVersionStatusEnum = pgEnum("quote_version_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "superseded",
  "expired",
])

export const participantRoleEnum = pgEnum("participant_role", [
  "traveler",
  "booker",
  "decision_maker",
  "finance",
  "other",
])
