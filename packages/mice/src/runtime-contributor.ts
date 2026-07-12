import type { VoyantPort } from "@voyant-travel/core/project"
import {
  type RelationshipsMiceRuntime,
  relationshipsMiceRuntimePort,
} from "@voyant-travel/relationships/voyant"
import { type MiceRuntime, miceRuntimePort } from "./runtime-port.js"

export interface MiceRuntimeContributorHost {
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Package-owned registration map for MICE deployment adapters. */
export function createMiceRuntimePortContribution(
  host: MiceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const mice = Promise.resolve()
    .then(() => host.getRuntimePort<RelationshipsMiceRuntime>(relationshipsMiceRuntimePort))
    .then(
      (relationships): MiceRuntime => ({
        resolveDelegatePersonById: (db, personId) => relationships.personExists(db, personId),
      }),
    )
  return { [miceRuntimePort.id]: mice }
}
