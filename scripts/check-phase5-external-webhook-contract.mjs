import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { inspectExternalWebhookDeliveryConvergence } from "./lib/phase5-external-webhook-convergence.mjs"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
const read = (file) => readFile(path.join(repoRoot, file), "utf8")

const [
  contracts,
  subscriptions,
  postgres,
  selectedEngine,
  engine,
  distribution,
  composition,
  deploymentGraph,
  catalog,
  packageJson,
  lockfile,
] = await Promise.all([
  read("packages/webhook-delivery/src/contracts.ts"),
  read("packages/webhook-delivery/src/subscriptions.ts"),
  read("packages/webhook-delivery/src/postgres-store.ts"),
  read("packages/webhook-delivery/src/selected-engine.ts"),
  read("packages/webhook-delivery/src/engine.ts"),
  read("packages/distribution/src/outbound-webhooks.ts"),
  read("packages/framework/src/runtime-composition.ts"),
  read("packages/framework/src/deployment-graph.ts"),
  read("packages/catalog/src/voyant.ts"),
  read("packages/distribution/package.json"),
  read("pnpm-lock.yaml"),
])

const failures = []
const requireSource = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}

requireSource(
  subscriptions,
  /assertWebhookSubscriptionCreateEvents\(input,[\s\S]*store\.create\(input\)/,
  "the production mutation service must validate creates before calling its store",
)
requireSource(
  subscriptions,
  /assertWebhookSubscriptionUpdateEvents\(input,[\s\S]*store\.update\(id, input\)/,
  "the production mutation service must validate updates before calling its store",
)
requireSource(
  postgres,
  /createPostgresWebhookSubscriptionService[\s\S]*createWebhookSubscriptionService\([\s\S]*insert\(infraWebhookSubscriptionsTable\)[\s\S]*update\(infraWebhookSubscriptionsTable\)/,
  "Postgres subscription writes must be routed through the validated package service",
)
requireSource(
  contracts,
  /isExternalWebhookPayloadSchema[\s\S]*x-voyant-redact[\s\S]*projectObject/,
  "external payloads must apply schema-owned field redaction and projection",
)
failures.push(
  ...inspectExternalWebhookDeliveryConvergence({
    distribution,
    selectedEngine,
    engine,
    queueAdapterExists: existsSync(path.join(repoRoot, "packages/webhook-delivery/src/queue.ts")),
  }),
)
requireSource(
  composition,
  /graphEventPayloadSchema: declaration\.payloadSchema/,
  "runtime composition must carry the selected package payload schema",
)
requireSource(
  deploymentGraph,
  /isExternalWebhookPayloadSchema\(event\.payloadSchema\)/,
  "deployment admission must reject external webhook schemas without explicit properties",
)
if ((catalog.match(/additionalProperties: false/g) ?? []).length < 2) {
  failures.push("Catalog's external payload schemas must use explicit field allowlists")
}

for (const file of await productionTypeScriptFiles(path.join(repoRoot, "packages"))) {
  const source = await readFile(file, "utf8")
  const mutatesSubscriptions =
    /\.insert\(infraWebhookSubscriptionsTable\)/.test(source) ||
    /\.update\(infraWebhookSubscriptionsTable\)[\s\S]{0,500}\.returning\(/.test(source)
  if (mutatesSubscriptions && !file.endsWith("packages/webhook-delivery/src/postgres-store.ts")) {
    failures.push(
      `webhook subscription mutation bypasses the package-owned service: ${path.relative(repoRoot, file)}`,
    )
  }
}
requireSource(
  packageJson,
  /"@voyant-travel\/webhook-delivery": "workspace:\^"/,
  "Distribution must declare the shared webhook-delivery dependency",
)
requireSource(
  lockfile,
  /packages\/distribution:[\s\S]*?'@voyant-travel\/webhook-delivery':[\s\S]*?link:\.\.\/webhook-delivery/,
  "The lockfile must place webhook-delivery in the Distribution importer",
)

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"))
  process.exitCode = 1
} else {
  console.log("Phase 5 external webhook contract: OK")
}

async function productionTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const location = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "test") {
        files.push(...(await productionTypeScriptFiles(location)))
      }
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(location)
    }
  }
  return files
}
