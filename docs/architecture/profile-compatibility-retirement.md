# Profile Compatibility Retirement

The resolved deployment graph is the sole selection and Node boot authority.
Default generators must not emit a managed-profile JSON file, runtime entries
must not carry a profile snapshot field, and starter readers must not require a
snapshot artifact or environment override.

The framework snapshot compatibility contract is retired. The `profile`,
`managed-jobs`, `managed-runtime`, and `managed-profile-compatibility` subpaths
are not published, and the corresponding source adapters, validators, dynamic
profile plugin/custom-source resolvers, and tests do not exist. There is no
runtime path from a serialized Operator profile to application composition.

Framework code, generated artifacts, starters, and generic hosts use project,
graph, deployment, scheduled-job, and Node-host vocabulary. Deployment modes
and provider validation remain generic in `deployment-types.ts` and graph
admission. The `managed-cloud` deployment mode is not a profile snapshot and
remains supported by the graph-native Node host.

The admin host retains a separate deprecated naming-only compatibility subpath;
it does not reconstruct product composition or consume profile snapshots.
Historical architecture documents may retain old terms when describing the
superseded design.
