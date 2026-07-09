// Generates the managed-profile snapshot the operator graph artifacts boot from.
//
// The managed runtime (`@voyant-travel/framework/managed-runtime`) composes the
// REAL API from a serialized project snapshot — a plain JSON file describing the
// profile, framework version, deployment mode, module set, and provider choices.
// `loadManagedProfileRuntime({ profileSnapshotPath })` reads this file, validates
// it, and mounts the composed `/api` in-process (voyant#3044).
//
// This reference snapshot is a SELF-HOSTED, provider-light composition: the FULL
// standard module set (an empty `modules` resolves to every default operator
// module) with in-memory providers everywhere except the Postgres database and
// Better Auth. It covers the full set on purpose so the managed runtime graph
// tracks the same operator module set that build/doctor/deploy inspect. List a
// subset only when the operator admin composition is pruned from the same graph.
//
// Re-run with `pnpm --filter operator generate:managed-profile` and commit the
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
  // Empty `modules` = the full default operator module set, so the composed API
  // matches every domain the packaged admin UI mounts (see comment above). List
  // a subset here only once the admin extensions are pruned from the same
  // snapshot (module subsetting, voyant#2107).
  modules: [],
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
console.info(`[operator] wrote ${outPath} (framework ${frameworkVersion})`)
