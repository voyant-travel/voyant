import { bookingsUiEnBase } from "./en-base.js"
import { bookingsUiEnCreateList } from "./en-create-list.js"
import { bookingsUiEnJourney } from "./en-journey.js"
import { bookingsUiEnOperations } from "./en-operations.js"
import { bookingsUiEnSections } from "./en-sections.js"
import type { BookingsUiMessages } from "./messages.js"

export const bookingsUiEn = {
  ...bookingsUiEnBase,
  ...bookingsUiEnSections,
  ...bookingsUiEnJourney,
  ...bookingsUiEnOperations,
  ...bookingsUiEnCreateList,
} satisfies BookingsUiMessages
