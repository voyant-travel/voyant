// Runtime exports for compatibility with edge/node adapters
export {
  createDbClient,
  createServerlessDbClient,
  type DbAdapter,
  type DisposableDbClient,
  db,
  getDb,
} from "../index.js"
export {
  dbClientDispose,
  dbSupportsTransactions,
  VOYANT_DB_DISPOSE,
  VOYANT_DB_SUPPORTS_TRANSACTIONS,
} from "../transaction-capability.js"
export { createPostgresAdvisoryLockManager } from "./locks.js"
