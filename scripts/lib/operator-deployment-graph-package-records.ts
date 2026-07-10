import {
  VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
  type VoyantGraphAdmissionPolicy,
  type VoyantGraphPackageRecord,
} from "../../packages/framework/src/deployment-graph.ts"

export const OPERATOR_GRAPH_ADMISSION_POLICY = {
  allowedSourceKinds: ["registry", "workspace"],
} as const satisfies VoyantGraphAdmissionPolicy

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
      compatibleWith: {
        targets: ["node", "voyant-cloud"],
        modes: ["local", "managed-cloud", "self-hosted"],
      },
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
