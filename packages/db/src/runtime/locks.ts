import type { ExecutionLockManager } from "@voyant-travel/core"
import postgres from "postgres"

type AdvisoryLockRow = { locked: boolean }

export function createPostgresAdvisoryLockManager(
  connectionString: string,
  options: {
    namespace?: string
  } = {},
): ExecutionLockManager {
  const sql = postgres(connectionString, {
    max: 1,
  })

  const resolveKey = (key: string) => {
    const namespace = options.namespace?.trim()
    return namespace ? `${namespace}:${key}` : key
  }

  return {
    async runExclusive<T>(key: string, task: () => Promise<T>) {
      const lockKey = resolveKey(key)
      const acquireResult = await sql<AdvisoryLockRow[]>`
        SELECT pg_try_advisory_lock(hashtextextended(${lockKey}, 0)) AS locked
      `

      if (!acquireResult[0]?.locked) {
        return { executed: false }
      }

      try {
        return {
          executed: true,
          value: await task(),
        }
      } finally {
        await sql`
          SELECT pg_advisory_unlock(hashtextextended(${lockKey}, 0))
        `
      }
    },
    async dispose() {
      await sql.end({ timeout: 0 })
    },
  }
}
