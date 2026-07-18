interface NodeAdminBetterAuthSecretEnv {
  BETTER_AUTH_ADMIN_SECRET?: string
}

/** Require the realm-specific admin secret before constructing Better Auth. */
export function requireNodeAdminBetterAuthSecret(env: NodeAdminBetterAuthSecretEnv): string {
  const secret = env.BETTER_AUTH_ADMIN_SECRET?.trim()
  if (!secret) throw new Error("Admin auth requires BETTER_AUTH_ADMIN_SECRET")
  return secret
}
