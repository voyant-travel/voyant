import type {
  AdminNavigationPreferencesClient,
  AdminNavigationPreferencesSnapshot,
} from "@voyant-travel/admin/navigation/preferences"
import { navigationPreferencesSnapshotSchema } from "@voyant-travel/navigation-preferences/contracts"

export const navigationPreferencesQueryKey = ["navigation-preferences"] as const

export async function loadNavigationPreferences(
  client: AdminNavigationPreferencesClient,
): Promise<AdminNavigationPreferencesSnapshot> {
  const response = await client.fetcher(`${client.baseUrl}/v1/admin/navigation-preferences`)
  if (!response.ok) throw new Error(`Navigation preferences request failed (${response.status})`)
  const payload = (await response.json()) as { data?: unknown }
  return navigationPreferencesSnapshotSchema.parse(payload.data)
}
