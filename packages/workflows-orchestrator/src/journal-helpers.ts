import type { JournalSlice } from "@voyant-travel/workflows/protocol"

export function emptyJournal(): JournalSlice {
  return {
    stepResults: {},
    waitpointsResolved: {},
    compensationsRun: {},
    metadataState: {},
    streamsCompleted: {},
  }
}
