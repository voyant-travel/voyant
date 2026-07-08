// Generates the managed-profile snapshot the source-free admin host boots from.
//
// The managed runtime (`@voyant-travel/framework/managed-runtime`) composes the
// REAL API from a serialized project snapshot — a plain JSON file describing the
// profile, framework version, deployment mode, module set, and provider choices.
// `loadManagedProfileRuntime({ profileSnapshotPath })` reads this file, validates
// it, and mounts the composed `/api` in-process (voyant#3044).
//
// This reference snapshot is a SELF-HOSTED, provider-light composition: a small
// module set (catalog + bookings + finance + relationships) with in-memory
// providers everywhere except the Postgres database and Better Auth. The small
// set keeps the API module graph — and therefore the Vite build — light while
// still proving the composition shape: `node dist/server/server.js` serving both
// the SSR admin UI and a real `/api` in one process.
//
// Re-run with `pnpm --filter managed-operator generate:snapshot` and commit the
// resulting `managed-profile.json`.
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { defineVoyantProject } from "@voyant-travel/framework/profile"

// Pin the snapshot to the framework version this host is built against, so the
// composed API graph and the recorded `frameworkVersion` never drift. The
// framework does not export `./package.json`, so read the workspace source of
// truth directly (this script only runs in the monorepo).
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const frameworkVersion = (
  JSON.parse(await readFile(join(repoRoot, "packages", "framework", "package.json"), "utf8")) as {
    version: string
  }
).version

const project = defineVoyantProject({
  profile: "operator",
  frameworkVersion,
  mode: "self-hosted",
  // A deliberately small module set keeps the reference build light. The
  // composition shape (real `/api` in one process) is identical regardless of
  // which modules are included.
  modules: ["catalog", "bookings", "finance", "relationships"],
  providers: {
    database: "postgres",
    storage: "memory",
    cache: "memory",
    sharedState: "memory",
    rateLimit: "memory",
    search: "none",
    email: "none",
    sms: "none",
    auth: "better-auth",
    scheduledJobs: "none",
    workflows: "none",
  },
})

const outPath = fileURLToPath(new URL("../managed-profile.json", import.meta.url))
await writeFile(outPath, `${JSON.stringify(project, null, 2)}\n`, "utf8")
console.info(`[managed-operator] wrote ${outPath} (framework ${frameworkVersion})`)
