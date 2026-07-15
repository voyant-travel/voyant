# Exporting From Voyant Cloud

Voyant Cloud exports a running Operator as a
`voyant.self-host-export-bundle.v1` bundle. The bundle is a data and admitted
graph handoff, not a runtime profile: it contains the canonical
`voyant.resolved-graph.v1`, graph hash and product BOM, framework version,
Postgres dump metadata, and an object-storage manifest.

The public framework contract is
`@voyant-travel/framework/self-host-export`. Project generation belongs to the
external CLI and must use the framework's `STANDARD_NODE_STARTER` contract. It
must not copy a framework package catalog or construct a second runtime graph.

## 1. Validate The Bundle

Verify archive checksums before using the framework API. Then validate the
envelope and graph:

```ts
import {
  projectVoyantSelfHostExport,
  validateVoyantSelfHostExportBundle,
} from "@voyant-travel/framework/self-host-export"

const validation = await validateVoyantSelfHostExportBundle(bundle)
if (!validation.ok) throw new Error(JSON.stringify(validation.issues, null, 2))

const projection = await projectVoyantSelfHostExport(validation.value, {
  providerOverrides: { sms: "twilio" },
})
if (!projection.ready) throw new Error(JSON.stringify(projection.diagnostics, null, 2))
```

Validation rejects a stale or malformed graph, a graph/envelope hash mismatch,
a product BOM mismatch, graph admission errors, invalid dump/object metadata,
or a database from a different migration-journal lineage.

The projection preserves the selected module, extension, and plugin IDs plus
their package-scoped JSON config. It derives installable package/version data
from the graph's admitted package records. A workspace, file, or unknown package
source is not portable from the bundle alone and blocks generation until that
package is published or supplied through an installable source.

## 2. Resolve Provider Diagnostics

Projection changes the deployment to `target: "node"` and
`mode: "self-hosted"`. Provider authority remains the projected
`deployment.providers` map; environment variables only configure those selected
providers.

The canonical Cloud remaps are:

| Role | Voyant Cloud | Self-host projection |
| --- | --- | --- |
| auth | `voyant-cloud` | `better-auth` |
| email | `voyant-cloud` | `smtp` |
| realtime | `voyant-cloud` | `local` |
| scheduled jobs | `cloud-scheduler` | `node-cron` |
| workflows | `voyant-cloud` | `self-hosted` |

Postgres, Redis, S3-compatible storage, Typesense, and Postgres outbound
webhooks remain selected and must be provisioned by the new operator. Cloud SMS
has no lossless default: choose `twilio` or `none` explicitly. Platform-only KV
providers and unknown values also require an explicit supported override. The
projection reports these as blocking diagnostics instead of emitting a project
that silently loses behavior.

Use `projection.provisioning.resources` as the environment and infrastructure
checklist. It includes the selected database, object storage, Redis/search,
Better Auth secrets, SMTP settings, SMS settings, and self-hosted workflow
database requirements. Preserve secrets through a secret manager; do not write
them into generated project source.

## 3. Generate The Standard Node Project

Generate from `projection.starter` and `projection.project`. Install the exact
framework version from the bundle and the package versions admitted by the
resolved graph. The generated config is selection intent; package manifests are
still the only authority for APIs, schemas, migrations, admin UI, workflows,
and runtime contributors.

Resolve the generated project before restoring production traffic. Compare its
selected IDs and package config with the projection and require a clean graph.
A different graph hash is expected because deployment mode, providers, resource
requirements, and any self-host-only migration selection changed. Package
selection drift is not expected.

## 4. Restore Postgres

Verify `database.dump.contentHash`, create an empty Postgres database, and
restore according to `database.format` (`pg-custom`, `pg-directory`, or `sql`).
Do not delete or rename `drizzle._voyant_migrations`: Cloud and standard Node use
the same `voyant.migration-journal-lineage.v1` journal keyed by `(source, tag)`
with immutable SQL content hashes.

After restore, run the generated project's migration command. Package migrations
already represented in the restored journal are no-ops. New migrations selected
only by the self-host provider plan, such as the standalone workflow runtime,
apply on the same lineage. A content-hash mismatch is migration drift and must
be investigated; never bypass it by editing the journal.

## 5. Restore Object Storage

Provision the selected S3-compatible buckets, verify every manifest entry's
content hash and byte length, and restore each object to its `logicalStore` and
`key`. Configure `S3_REGION`, media/documents bucket names, endpoint, and
credentials from the projected requirements. Logical store names are stable;
provider-specific bucket names are deployment configuration.

## 6. Verify Before Cutover

Run project/graph doctor checks, migration dry-run and apply, then build and boot
the Node application. Verify at minimum:

- the resolved graph is admitted and its selected IDs/config match the
  projection;
- every projected resource requirement is satisfied;
- the restored migration journal has no immutable-content drift and only
  expected self-host additions are pending;
- every object-storage manifest entry is present and hash-correct;
- admin authentication, email/SMS choice, search, scheduled jobs, workflows,
  outbound webhooks, and health checks work against the new providers.

Keep the Cloud deployment read-only during final verification, then switch
traffic only after writes have been quiesced and the final database/object delta
has been restored.
