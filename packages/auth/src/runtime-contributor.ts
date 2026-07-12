import {
  type IdentityAccessRuntimeProvider,
  identityAccessRuntimePort,
} from "./identity-access-runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface AuthRuntimePortContribution {
  identityAccess: RuntimePortValue<IdentityAccessRuntimeProvider>
}

/** Package-owned registration map for Auth deployment adapters. */
export function createAuthRuntimePortContribution(
  contribution: AuthRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [identityAccessRuntimePort.id]: contribution.identityAccess }
}
