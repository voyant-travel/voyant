/**
 * Defense-in-depth hardening for rendered HTML documents that are
 * handed to script-capable consumers — Cloudflare Browser Rendering
 * (PDF generation runs a headless, network-enabled Chrome), HTML
 * renditions stored/served as `text/html`, etc.
 *
 * This module is NOT a general-purpose HTML sanitizer. The first line
 * of defense is output-escaping in the template renderer (see
 * `template-renderer.ts`); these helpers exist so that even HTML that
 * slipped through escaping (e.g. via `| raw`, an operator-supplied
 * `htmlWrapper`, or a legacy stored rendition) cannot execute script
 * or exfiltrate data during rendering. For true sanitization of
 * untrusted HTML, use a real sanitizer (e.g. `sanitize-html`).
 */

/**
 * Locked-down default Content-Security-Policy for rendered documents:
 * no scripts, no fetch/XHR/frames/fonts/media, inline styles allowed
 * (templates use `<style>`/`style=""`), images restricted to `data:`
 * and `https:`.
 */
export const DEFAULT_RENDERED_HTML_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;"

const SCRIPT_BLOCK_RE = /<script\b[\s\S]*?<\/script\s*>/gi
const SCRIPT_OPEN_RE = /<script\b[^>]*>/gi
const SCRIPT_CLOSE_RE = /<\/script\s*>/gi
const HEAD_OPEN_RE = /<head\b[^>]*>/i
const HTML_OPEN_RE = /<html\b[^>]*>/i

/**
 * Remove `<script>` elements (paired blocks plus any orphan opening or
 * closing tags) from an HTML string. Best-effort, regex-based — pair it
 * with the CSP from `injectContentSecurityPolicyMeta` rather than
 * relying on it alone.
 */
export function stripScriptTags(html: string): string {
  return html.replace(SCRIPT_BLOCK_RE, "").replace(SCRIPT_OPEN_RE, "").replace(SCRIPT_CLOSE_RE, "")
}

/**
 * Inject a `<meta http-equiv="Content-Security-Policy">` tag into a
 * rendered HTML document. The meta tag is inserted as early as
 * possible (right after `<head>`, falling back to a synthesized
 * `<head>` after `<html>`, falling back to prepending for fragments)
 * because a meta-delivered CSP only governs content parsed after it.
 *
 * With the default policy, a headless Chrome rendering the document
 * (Cloudflare Browser Rendering) will refuse to run inline/external
 * scripts and inline event handlers, and will block all network
 * requests except `https:`/`data:` images.
 */
export function injectContentSecurityPolicyMeta(
  html: string,
  csp: string = DEFAULT_RENDERED_HTML_CSP,
): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replaceAll('"', "&quot;")}">`

  const headMatch = html.match(HEAD_OPEN_RE)
  if (headMatch && headMatch.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length
    return `${html.slice(0, insertAt)}${meta}${html.slice(insertAt)}`
  }

  const htmlMatch = html.match(HTML_OPEN_RE)
  if (htmlMatch && htmlMatch.index !== undefined) {
    const insertAt = htmlMatch.index + htmlMatch[0].length
    return `${html.slice(0, insertAt)}<head>${meta}</head>${html.slice(insertAt)}`
  }

  return `${meta}${html}`
}

export interface HardenRenderedHtmlOptions {
  /**
   * CSP to inject as a `<meta http-equiv>` tag. Defaults to
   * `DEFAULT_RENDERED_HTML_CSP`. Pass `false` to skip CSP injection.
   */
  csp?: string | false
  /** Strip `<script>` elements. Defaults to `true`. */
  stripScripts?: boolean
}

/**
 * Harden a rendered HTML document before handing it to Cloudflare
 * Browser Rendering (PDF generation) or serving it as `text/html`:
 * strips `<script>` elements and injects a locked-down CSP meta tag.
 *
 * Typical call site (legal contracts browser-rendered PDFs):
 *
 *   const html = hardenRenderedHtmlDocument(await wrapHtml(context))
 *   await cloudClient.browser.pdf({ html, ... })
 */
export function hardenRenderedHtmlDocument(
  html: string,
  options?: HardenRenderedHtmlOptions,
): string {
  let output = options?.stripScripts === false ? html : stripScriptTags(html)
  if (options?.csp !== false) {
    output = injectContentSecurityPolicyMeta(output, options?.csp || DEFAULT_RENDERED_HTML_CSP)
  }
  return output
}
