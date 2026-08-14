import { z } from "zod"

/**
 * The lookaround-free email pattern this workspace standardises on.
 *
 * Zod's default email pattern opens with `^(?!\.)(?!.*\.\.)`, and providers
 * that validate LLM tool schemas with an RE2-style engine reject regex
 * lookaround outright:
 *
 *     AI_APICallError: Invalid JSON schema: regex lookaround is not supported.
 *
 * A client sends EVERY authorized tool schema in one model call, so a single
 * offending field takes down every turn of the conversation — including
 * questions that never touch the Tool carrying it (voyant#4598).
 *
 * `rfc5322Email` is zod's own alternative pattern and needs no lookaround: it
 * spells the "no leading dot, no consecutive dots" rule structurally, as
 * dot-separated runs of non-dot characters. It rejects everything the default
 * rejects, and additionally accepts three forms RFC 5322 permits and the
 * default does not — a quoted local part, an IP-literal domain, and a non-ASCII
 * local part. So swapping to it is strictly more permissive *and* strictly more
 * correct, never a loosened check.
 *
 * Reach for this directly only when the field also needs `.trim()`, which must
 * run before the format check: `z.string().trim().email({ pattern: emailPattern })`.
 * Otherwise use {@link emailAddress}.
 */
export const emailPattern = z.regexes.rfc5322Email

/**
 * An email address, validated with a pattern a strict-schema LLM client can
 * parse. Use this instead of `z.email()` / `z.string().email()` anywhere the
 * schema can reach a Tool's `inputSchema`.
 *
 * `verify:tool-schema-portability` fails the build if a lookaround pattern
 * reaches a Tool schema again.
 */
export function emailAddress(error?: string) {
  return z.email({ pattern: emailPattern, ...(error === undefined ? {} : { error }) })
}
