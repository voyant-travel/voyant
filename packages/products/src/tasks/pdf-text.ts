const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }

    return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

export function plainTextForPdf(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  const textWithoutTags = /<[a-z][\s\S]*>/i.test(trimmed)
    ? trimmed
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\s*li\b[^>]*>/gi, " * ")
        .replace(
          /<\s*\/\s*(address|article|aside|blockquote|div|footer|h[1-6]|header|li|main|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)\s*>/gi,
          "\n",
        )
        .replace(/<[^>]*>/g, "")
    : trimmed

  return decodeHtmlEntities(textWithoutTags)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
}
