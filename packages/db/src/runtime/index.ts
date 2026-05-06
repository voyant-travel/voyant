// Runtime exports for compatibility with edge/node adapters
export { createDbClient, type DbAdapter, db, getDb } from "../index.js"
export { createPostgresAdvisoryLockManager } from "./locks.js"
