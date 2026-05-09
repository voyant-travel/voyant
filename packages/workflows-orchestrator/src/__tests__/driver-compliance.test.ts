// InMemory driver — runs the shared compliance suite. The suite itself
// lives in `../testing/driver-compliance.ts` so downstream packages
// (`@voyantjs/workflows-orchestrator-node`, `-cloudflare`) can import +
// run identical assertions against their own driver factories.

import { createInMemoryDriver } from "../driver-inmemory.js"
import { runDriverComplianceSuite } from "../testing/driver-compliance.js"

runDriverComplianceSuite("InMemory", () => createInMemoryDriver())
