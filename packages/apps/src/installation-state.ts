import { ApiHttpError } from "@voyant-travel/hono"
import type { AppInstallation } from "./schema.js"

type AppInstallationStatus = AppInstallation["status"]

export type LifecycleTransitionPlan =
  | { outcome: "unchanged"; status: AppInstallationStatus }
  | { outcome: "updated"; from: AppInstallationStatus; to: AppInstallationStatus }

export function planLifecycleTransition(
  current: AppInstallationStatus,
  allowedFrom: readonly AppInstallationStatus[],
  to: AppInstallationStatus,
  action: string,
): LifecycleTransitionPlan {
  if (current === to) return { outcome: "unchanged", status: current }
  if (!allowedFrom.includes(current)) throw invalidTransition(current, action)
  return { outcome: "updated", from: current, to }
}

export function canInstallOver(status: AppInstallationStatus): boolean {
  return status === "uninstalled" || status === "revoked"
}

export function invalidTransition(from: string, action: string) {
  return new ApiHttpError(`Cannot ${action} app installation from ${from}`, {
    status: 409,
    code: "app_installation_invalid_transition",
  })
}
