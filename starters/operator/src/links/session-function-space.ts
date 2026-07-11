import { defineLink } from "@voyant-travel/core"
import { sessionLinkable } from "@voyant-travel/mice/linkables"
import { functionSpaceLinkable } from "@voyant-travel/operations/places/linkables"

/**
 * A MICE agenda session is held in one function space; a space hosts many
 * sessions. Backs the loose `mice_program_sessions.function_space_id` column.
 * See RFC voyant#1489 (Phase 2).
 */
export default defineLink(functionSpaceLinkable, {
  linkable: sessionLinkable,
  isList: true,
})
