import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
const read = (file) => readFile(path.join(repoRoot, file), "utf8")

const [contracts, queue, distribution, composition, runtime, catalog, packageJson, lockfile] =
  await Promise.all([
    read("packages/webhook-delivery/src/contracts.ts"),
    read("packages/webhook-delivery/src/queue.ts"),
    read("packages/distribution/src/outbound-webhooks.ts"),
    read("packages/framework/src/runtime-composition.ts"),
    read("packages/framework/src/runtime-lowering.ts"),
    read("packages/catalog/src/voyant.ts"),
    read("packages/distribution/package.json"),
    read("pnpm-lock.yaml"),
  ])

const failures = []
const requireSource = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}

requireSource(
  contracts,
  /assertWebhookSubscriptionCreateEvents[\s\S]*assertSelectedExternalEvents/,
  "subscription creates must validate selected external event ids",
)
requireSource(
  runtime,
  /assertSubscriptionCreateEvents[\s\S]*assertSelectedExternalSubscriptionEvents/,
  "runtime subscription creates must validate selected external event ids",
)
requireSource(
  runtime,
  /assertSubscriptionUpdateEvents[\s\S]*assertSelectedExternalSubscriptionEvents/,
  "runtime subscription updates must validate selected external event ids",
)
requireSource(
  contracts,
  /assertWebhookSubscriptionUpdateEvents[\s\S]*assertSelectedExternalEvents/,
  "subscription updates must validate selected external event ids",
)
requireSource(
  contracts,
  /x-voyant-redact[\s\S]*projectObject/,
  "external payloads must apply schema-owned field redaction and projection",
)
requireSource(
  queue,
  /prepareExternalWebhookEvent[\s\S]*x-voyant-event-contract/,
  "queued webhook delivery must apply the external contract before persistence",
)
requireSource(
  distribution,
  /from "@voyant-travel\/webhook-delivery"[\s\S]*queueExternalWebhookEvent/,
  "Distribution must delegate graph webhook queue semantics to webhook-delivery",
)
requireSource(
  composition,
  /graphEventPayloadSchema: declaration\.payloadSchema/,
  "runtime composition must carry the selected package payload schema",
)
if ((catalog.match(/additionalProperties: false/g) ?? []).length < 2) {
  failures.push("Catalog's external payload schemas must use explicit field allowlists")
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
