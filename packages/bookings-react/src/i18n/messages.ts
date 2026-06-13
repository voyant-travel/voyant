import type { BookingsUiBaseMessages } from "./messages-base.js"
import type { BookingsUiCreateListMessages } from "./messages-create-list.js"
import type { BookingsUiJourneyMessages } from "./messages-journey.js"
import type { BookingsUiOperationsMessages } from "./messages-operations.js"
import type { BookingsUiSectionsMessages } from "./messages-sections.js"

export type BookingsUiMessages = BookingsUiBaseMessages &
  BookingsUiSectionsMessages &
  BookingsUiJourneyMessages &
  BookingsUiOperationsMessages &
  BookingsUiCreateListMessages
