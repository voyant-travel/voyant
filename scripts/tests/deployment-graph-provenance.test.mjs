import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { packageRecordsFromPnpmLockfile } from "../lib/deployment-graph-provenance.mjs"

const lockfile = `
lockfileVersion: '9.0'

importers:
  packages/framework:
    dependencies:
      '@voyant-travel/bookings':
        specifier: workspace:*
        version: link:../bookings
      '@voyant-travel/cloud-sdk':
        specifier: ^0.11.0
        version: 0.11.0(typesense@3.0.6)
  starters/operator:
    dependencies:
      '@voyant-travel/plugin-netopia':
        specifier: ^0.105.18
        version: 0.105.18(@types/pg@8.20.0)(postgres@3.4.9)

packages:
  '@voyant-travel/cloud-sdk@0.11.0':
    resolution: {integrity: sha512-cloud}
  '@voyant-travel/plugin-netopia@0.105.18':
    resolution: {integrity: sha512-netopia}
`

describe("deployment graph package provenance", () => {
  it("derives workspace and registry package records from pnpm lockfile importers", () => {
    const records = packageRecordsFromPnpmLockfile(lockfile, {
      packageNames: [
        "@voyant-travel/plugin-netopia",
        "@voyant-travel/bookings",
        "@acme/custom-module",
      ],
      workspacePackageVersions: {
        "@voyant-travel/bookings": "0.149.0",
      },
    })

    assert.deepEqual(records, [
      {
        packageName: "@acme/custom-module",
        source: { kind: "unknown" },
      },
      {
        packageName: "@voyant-travel/bookings",
        version: "0.149.0",
        source: { kind: "workspace", reference: "link:../bookings" },
      },
      {
        packageName: "@voyant-travel/plugin-netopia",
        version: "0.105.18",
        source: {
          kind: "registry",
          reference:
            "pnpm-lock:@voyant-travel/plugin-netopia@0.105.18(@types/pg@8.20.0)(postgres@3.4.9)",
          integrity: "sha512-netopia",
        },
      },
    ])
  })

  it("can scope provenance to selected pnpm importers", () => {
    const records = packageRecordsFromPnpmLockfile(lockfile, {
      packageNames: ["@voyant-travel/plugin-netopia"],
      importerPaths: ["packages/framework"],
    })

    assert.deepEqual(records, [
      {
        packageName: "@voyant-travel/plugin-netopia",
        source: { kind: "unknown" },
      },
    ])
  })
})
