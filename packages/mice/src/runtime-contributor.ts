import { type MiceRuntime, miceRuntimePort } from "./runtime-port.js"

type ResolveDelegatePersonById = MiceRuntime["resolveDelegatePersonById"]

export interface MiceRuntimeContributorHost {
  capabilities: {
    relationshipsService: {
      getPersonById(
        db: Parameters<ResolveDelegatePersonById>[0],
        personId: string,
      ): Promise<unknown>
    }
  }
}

/** Package-owned registration map for MICE deployment adapters. */
export function createMiceRuntimePortContribution(
  host: MiceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const mice: MiceRuntime = {
    resolveDelegatePersonById: async (db, personId) =>
      (await host.capabilities.relationshipsService.getPersonById(db, personId)) != null,
  }
  return { [miceRuntimePort.id]: mice }
}
