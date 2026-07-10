import {
  VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
  type VoyantGraphAdmissionPolicy,
  type VoyantGraphPackageRecord,
  type VoyantPackageMetadata,
} from "../../packages/framework/src/deployment-graph.ts"

export const OPERATOR_GRAPH_ADMISSION_POLICY = {
  allowedSourceKinds: ["registry", "workspace"],
} as const satisfies VoyantGraphAdmissionPolicy

const OPERATOR_GRAPH_COMPATIBILITY = {
  framework: ">=0.26.0",
  targets: ["node", "voyant-cloud"],
  modes: ["local", "managed-cloud", "self-hosted"],
} as const

export const OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES = {
  "@voyant-travel/plugin-netopia": {
    schemaVersion: VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
    kind: "plugin",
    compatibleWith: OPERATOR_GRAPH_COMPATIBILITY,
  },
} as const satisfies Record<string, VoyantPackageMetadata>

const OPERATOR_LOCAL_PACKAGE_RECORDS = [
  {
    packageName: "@voyant-travel/operator",
    source: {
      kind: "workspace",
      reference: "starters/operator",
    },
    metadata: {
      schemaVersion: VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
      kind: "module",
      compatibleWith: OPERATOR_GRAPH_COMPATIBILITY,
    },
  },
] as const satisfies readonly VoyantGraphPackageRecord[]

export function withOperatorDeploymentLocalPackageRecords(
  records: readonly VoyantGraphPackageRecord[],
): VoyantGraphPackageRecord[] {
  const byPackageName = new Map(records.map((record) => [record.packageName, record]))
  for (const record of OPERATOR_LOCAL_PACKAGE_RECORDS) {
    if (byPackageName.has(record.packageName)) byPackageName.set(record.packageName, record)
  }
  return [...byPackageName.values()].sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  )
}
