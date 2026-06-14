# Voyant Travel NPM Publish Checklist

This repository now publishes package identities under `@voyant-travel/*`.
During the bootstrap window, a few external dependencies still resolve through
old `@voyantjs/*` npm alias targets until those external packages are republished.
Do not change workspace package `name` fields back to `@voyantjs/*`.

Temporary dependency aliases:

- `@voyant-travel/cloud-sdk` -> `npm:@voyantjs/cloud-sdk@^0.8.0`
- `@voyant-travel/data-sdk` -> `npm:@voyantjs/data-sdk@^0.4.0`
- `@voyant-travel/connect-adapter` -> `npm:@voyantjs/connect-adapter@0.2.20`
- `@voyant-travel/connect-cruises` -> `npm:@voyantjs/connect-cruises@0.3.13`
- `@voyant-travel/connect-sdk` -> `npm:@voyantjs/connect-sdk@0.7.1`
- `@voyant-travel/cli` -> `npm:@voyantjs/cli@^0.26.0`

Publishable workspace package names at this point:

- `@voyant-travel/accommodations-contracts`
- `@voyant-travel/accommodations`
- `@voyant-travel/action-ledger-react`
- `@voyant-travel/action-ledger`
- `@voyant-travel/admin-app`
- `@voyant-travel/admin-client`
- `@voyant-travel/admin-contracts`
- `@voyant-travel/admin-react`
- `@voyant-travel/admin`
- `@voyant-travel/auth-react`
- `@voyant-travel/auth`
- `@voyant-travel/bookings-contracts`
- `@voyant-travel/bookings-react`
- `@voyant-travel/bookings`
- `@voyant-travel/catalog-authoring`
- `@voyant-travel/catalog-contracts`
- `@voyant-travel/catalog-react`
- `@voyant-travel/catalog`
- `@voyant-travel/charters-contracts`
- `@voyant-travel/charters-react`
- `@voyant-travel/charters`
- `@voyant-travel/commerce-react`
- `@voyant-travel/commerce`
- `@voyant-travel/core`
- `@voyant-travel/crm-contracts`
- `@voyant-travel/cruises-contracts`
- `@voyant-travel/cruises-react`
- `@voyant-travel/cruises`
- `@voyant-travel/db`
- `@voyant-travel/distribution-react`
- `@voyant-travel/distribution`
- `@voyant-travel/extras-contracts`
- `@voyant-travel/finance-contracts`
- `@voyant-travel/finance-react`
- `@voyant-travel/finance`
- `@voyant-travel/flights-contracts`
- `@voyant-travel/flights-react`
- `@voyant-travel/flights`
- `@voyant-travel/hono`
- `@voyant-travel/i18n`
- `@voyant-travel/identity-contracts`
- `@voyant-travel/identity-react`
- `@voyant-travel/identity`
- `@voyant-travel/inventory-react`
- `@voyant-travel/inventory`
- `@voyant-travel/legal-contracts`
- `@voyant-travel/legal-react`
- `@voyant-travel/legal`
- `@voyant-travel/notifications-react`
- `@voyant-travel/notifications`
- `@voyant-travel/octo`
- `@voyant-travel/operations-react`
- `@voyant-travel/operations`
- `@voyant-travel/plugin-netopia`
- `@voyant-travel/plugin-payload-cms`
- `@voyant-travel/plugin-sanity-cms`
- `@voyant-travel/plugin-smartbill`
- `@voyant-travel/products-contracts`
- `@voyant-travel/quotes-react`
- `@voyant-travel/quotes`
- `@voyant-travel/react`
- `@voyant-travel/relationships-react`
- `@voyant-travel/relationships`
- `@voyant-travel/schema-kit`
- `@voyant-travel/storage`
- `@voyant-travel/storefront-react`
- `@voyant-travel/storefront-sdk`
- `@voyant-travel/storefront`
- `@voyant-travel/suppliers-contracts`
- `@voyant-travel/templating`
- `@voyant-travel/transactions-contracts`
- `@voyant-travel/trips-react`
- `@voyant-travel/trips`
- `@voyant-travel/types`
- `@voyant-travel/ui`
- `@voyant-travel/utils`
- `@voyant-travel/vite-config`
- `@voyant-travel/worker-runtime`
- `@voyant-travel/workflow-runs`
- `@voyant-travel/workflows-cloud-adapter`
- `@voyant-travel/workflows-node-step-container`
- `@voyant-travel/workflows-orchestrator-cloudflare`
- `@voyant-travel/workflows-orchestrator-node`
- `@voyant-travel/workflows-orchestrator`
- `@voyant-travel/workflows-react`
- `@voyant-travel/workflows`

Regenerate this list with:

```sh
node - <<'NODE'
const fs = require("fs");
const { execSync } = require("child_process");
const files = execSync("rg --files -g package.json", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.name?.startsWith("@voyant-travel/") && pkg.private !== true) {
    console.log(`${pkg.name}@${pkg.version ?? "0.0.0"}\t${file}`);
  }
}
NODE
```
