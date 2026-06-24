export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CurrentUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  locale: string
  timezone: string | null
  uiPrefs: Record<string, JsonValue> | null
  isSuperAdmin: boolean
  isSupportUser: boolean
  createdAt: string
  profilePictureUrl?: string | null
}

export type AuthMode = "local"
export type BootstrapStatus = { hasUsers: boolean; authMode?: AuthMode }
