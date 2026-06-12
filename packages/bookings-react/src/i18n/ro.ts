import type { BookingsUiMessages } from "./messages.js"
import { bookingsUiRoBase } from "./ro-base.js"
import { bookingsUiRoCreateList } from "./ro-create-list.js"
import { bookingsUiRoJourney } from "./ro-journey.js"
import { bookingsUiRoOperations } from "./ro-operations.js"
import { bookingsUiRoSections } from "./ro-sections.js"

export const bookingsUiRo = {
  ...bookingsUiRoBase,
  ...bookingsUiRoSections,
  ...bookingsUiRoJourney,
  ...bookingsUiRoOperations,
  ...bookingsUiRoCreateList,
} satisfies BookingsUiMessages
