import { adminChromeMessages } from "@voyant-travel/i18n"

/**
 * Derives a two-character uppercase initials string from a user's name or
 * email address. Used by avatar fallbacks.
 *
 * Rules (in priority order):
 * 1. If `firstName` + `lastName` are available → "FL"
 * 2. If only `firstName` → first two characters of first name
 * 3. If only `lastName` → first two characters of last name
 * 4. If `email` has a prefix of ≥2 chars → first two characters of prefix
 * 5. If `email` prefix is 1 char → that character
 * 6. Otherwise → "?"
 */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const f = (firstName ?? "").trim()
  const l = (lastName ?? "").trim()

  if (f && l) {
    return (f.charAt(0) + l.charAt(0)).toUpperCase()
  }
  if (f) {
    return f.slice(0, 2).toUpperCase()
  }
  if (l) {
    return l.slice(0, 2).toUpperCase()
  }

  const prefix = (email ?? "").split("@")[0] ?? ""
  if (prefix.length >= 2) return prefix.slice(0, 2).toUpperCase()
  if (prefix.length === 1) return prefix.toUpperCase()
  return "?"
}

/**
 * Computes display name for a user, preferring `firstName + lastName`, falling
 * back to `name`, then `email`, then the default English catalog value.
 */
export function getDisplayName(
  user: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    email?: string | null
  },
  fallback = adminChromeMessages.en.unknownUser,
): string {
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  if (combined) return combined
  if (user.name?.trim()) return user.name.trim()
  if (user.email?.trim()) return user.email.trim()
  return fallback
}
