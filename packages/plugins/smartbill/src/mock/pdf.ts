/**
 * Builds a small but well-formed single-page PDF that satisfies SDKs
 * expecting `application/pdf` bytes. The label is rendered on the page
 * so the file is recognisable when opened by hand.
 */
export function createPlaceholderPdf(label: string): Uint8Array {
  const escapedLabel = label.replace(/[()\\]/g, (m) => `\\${m}`)
  const stream = `BT /F1 18 Tf 72 720 Td (${escapedLabel}) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  parts.push(encoder.encode("%PDF-1.4\n%"))
  // Binary marker: any four bytes >=128 satisfy PDF readers' "this file is binary" probe.
  parts.push(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  let length = parts.reduce((sum, p) => sum + p.byteLength, 0)
  const offsets: number[] = []
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length)
    const chunk = encoder.encode(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`)
    parts.push(chunk)
    length += chunk.byteLength
  }
  const xrefStart = length
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  parts.push(encoder.encode(xref))
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}
