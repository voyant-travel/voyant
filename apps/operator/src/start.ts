import { z } from "zod"

// Zod's optional object-schema JIT probes `new Function`, which a strict CSP
// correctly blocks. The operator favors CSP compatibility over that micro-
// optimization and configures Zod before schema chunks are loaded.
if (typeof window !== "undefined") {
  z.config({ jitless: true })
}

export { standardOperatorStart as startInstance } from "@voyant-travel/admin-host/start"
