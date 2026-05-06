// /packages/db/src/lib/index.ts
// Re-export all TypeID utilities

export {
  anyTypeIdSchema,
  compareIds,
  decodeId,
  getPrefix,
  getTimestamp,
  isValidId,
  newId,
  newIdFromPrefix,
  PREFIXES,
  type PrefixKey,
  type PrefixValue,
  typeIdSchema,
  typeIdSchemaOptional,
  typeIdSchemas,
} from "./typeid.js"
export {
  TYPEID_MAX_LENGTH,
  typeId,
  typeIdManual,
  typeIdOptimized,
  typeIdRef,
  typeIdRefOptimized,
} from "./typeid-column.js"
