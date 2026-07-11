// Federated deployment schema selection. This edge application is outside the
// framework-owned Operator deployment graph, so its migration closure is
// explicit rather than authored through application config.
export const schema = [
  "../../packages/db/src/schema/index.ts",
  "../../packages/action-ledger/src/schema.ts",
  "../../packages/relationships/src/schema.ts",
  "../../packages/identity/src/schema.ts",
  "../../packages/workflow-runs/src/schema.ts",
] as const
