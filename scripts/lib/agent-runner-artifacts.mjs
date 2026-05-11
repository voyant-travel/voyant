import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const encoder = new TextEncoder()

export function artifactPublisherFromEnv(env = process.env, options = {}) {
  const bucket = firstEnv(env, "VOYANT_AGENT_ARTIFACT_BUCKET", "VOYANT_AGENT_R2_BUCKET")
  const accessKeyId = firstEnv(
    env,
    "VOYANT_AGENT_ARTIFACT_ACCESS_KEY_ID",
    "VOYANT_AGENT_R2_ACCESS_KEY_ID",
  )
  const secretAccessKey = firstEnv(
    env,
    "VOYANT_AGENT_ARTIFACT_SECRET_ACCESS_KEY",
    "VOYANT_AGENT_R2_SECRET_ACCESS_KEY",
  )
  const endpoint =
    firstEnv(env, "VOYANT_AGENT_ARTIFACT_ENDPOINT", "VOYANT_AGENT_R2_ENDPOINT") ??
    r2Endpoint(firstEnv(env, "VOYANT_AGENT_R2_ACCOUNT_ID"))
  const publicBaseUrl = firstEnv(
    env,
    "VOYANT_AGENT_ARTIFACT_PUBLIC_BASE_URL",
    "VOYANT_AGENT_R2_PUBLIC_BASE_URL",
  )

  const missing = []
  if (!bucket) missing.push("VOYANT_AGENT_ARTIFACT_BUCKET or VOYANT_AGENT_R2_BUCKET")
  if (!accessKeyId) {
    missing.push("VOYANT_AGENT_ARTIFACT_ACCESS_KEY_ID or VOYANT_AGENT_R2_ACCESS_KEY_ID")
  }
  if (!secretAccessKey) {
    missing.push("VOYANT_AGENT_ARTIFACT_SECRET_ACCESS_KEY or VOYANT_AGENT_R2_SECRET_ACCESS_KEY")
  }
  if (!endpoint) {
    missing.push("VOYANT_AGENT_ARTIFACT_ENDPOINT or VOYANT_AGENT_R2_ACCOUNT_ID")
  }
  if (!publicBaseUrl) {
    missing.push("VOYANT_AGENT_ARTIFACT_PUBLIC_BASE_URL or VOYANT_AGENT_R2_PUBLIC_BASE_URL")
  }
  if (missing.length > 0) {
    throw new Error(`artifact publishing is missing configuration: ${missing.join(", ")}`)
  }

  return new S3ArtifactPublisher({
    accessKeyId,
    bucket,
    endpoint,
    fetchImpl: options.fetchImpl,
    forcePathStyle: boolEnv(env.VOYANT_AGENT_ARTIFACT_FORCE_PATH_STYLE, true),
    prefix: firstEnv(env, "VOYANT_AGENT_ARTIFACT_PREFIX", "VOYANT_AGENT_R2_PREFIX"),
    publicBaseUrl,
    region: firstEnv(env, "VOYANT_AGENT_ARTIFACT_REGION", "VOYANT_AGENT_R2_REGION") ?? "auto",
    secretAccessKey,
  })
}

export async function publishArtifactDirectory({
  directory,
  issueNumber,
  publisher,
  reference,
  repository,
}) {
  const files = listFiles(directory)
  const plan = artifactPublicationPlan({ publisher, reference, repository })
  const keyPrefix = plan.keyPrefix
  const uploaded = []

  for (const filePath of files) {
    const relativePath = toPosixPath(path.relative(directory, filePath))
    const contentType = contentTypeForPath(filePath)
    const body = readFileSync(filePath)
    uploaded.push(
      await publisher.upload({
        body,
        contentType,
        key: `${keyPrefix}/${relativePath}`,
        metadata: {
          issue: String(issueNumber),
          reference,
          repository,
        },
        path: relativePath,
      }),
    )
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    issueNumber: Number(issueNumber),
    keyPrefix,
    reference,
    repository,
    uploaded,
  }
  const indexBody = artifactIndexMarkdown(manifest)
  const index = await publisher.upload({
    body: Buffer.from(indexBody),
    contentType: "text/markdown; charset=utf-8",
    key: `${keyPrefix}/index.md`,
    metadata: {
      issue: String(issueNumber),
      reference,
      repository,
    },
    path: "index.md",
  })
  const manifestObject = await publisher.upload({
    body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
    contentType: "application/json; charset=utf-8",
    key: `${keyPrefix}/manifest.json`,
    metadata: {
      issue: String(issueNumber),
      reference,
      repository,
    },
    path: "manifest.json",
  })

  return {
    indexUrl: index.url,
    keyPrefix,
    manifestUrl: manifestObject.url,
    uploaded: [...uploaded, index, manifestObject],
  }
}

export function artifactPublicationPlan({ publisher, reference, repository }) {
  const keyPrefix = objectKeyPrefix({
    prefix: publisher.prefix,
    reference,
    repository,
  })

  return {
    indexUrl: publisher.publicUrl(`${keyPrefix}/index.md`),
    keyPrefix,
    manifestUrl: publisher.publicUrl(`${keyPrefix}/manifest.json`),
  }
}

export class S3ArtifactPublisher {
  constructor({
    accessKeyId,
    bucket,
    endpoint,
    fetchImpl = globalThis.fetch,
    forcePathStyle = true,
    prefix = "agent-evidence",
    publicBaseUrl,
    region,
    secretAccessKey,
  }) {
    if (!fetchImpl) throw new Error("artifact publishing requires fetch")
    this.accessKeyId = accessKeyId
    this.bucket = bucket
    this.endpoint = endpoint.replace(/\/+$/g, "")
    this.fetchImpl = fetchImpl
    this.forcePathStyle = forcePathStyle
    this.prefix = normalizeKeyPart(prefix || "agent-evidence")
    this.publicBaseUrl = `${publicBaseUrl.replace(/\/+$/g, "")}/`
    this.region = region
    this.secretAccessKey = secretAccessKey
  }

  async upload({ body, contentType, key, metadata = {}, path: artifactPath }) {
    const url = this.objectUrl(key)
    const headers = {
      "content-type": contentType,
    }
    for (const [name, value] of Object.entries(metadata)) {
      headers[`x-amz-meta-${name}`] = value
    }

    const signed = await signRequest({
      accessKeyId: this.accessKeyId,
      body,
      headers,
      method: "PUT",
      region: this.region,
      secretAccessKey: this.secretAccessKey,
      url,
    })
    const response = await this.fetchImpl(url, {
      body,
      headers: signed.headers,
      method: "PUT",
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`artifact upload failed (${response.status}) for ${artifactPath}: ${text}`)
    }

    return {
      contentType,
      key,
      path: artifactPath,
      size: body.byteLength,
      url: `${this.publicBaseUrl}${key}`,
    }
  }

  objectUrl(key) {
    if (this.forcePathStyle) {
      return `${this.endpoint}/${encodeKey(this.bucket)}/${encodeObjectKey(key)}`
    }
    return `${this.endpoint}/${encodeObjectKey(key)}`
  }

  publicUrl(key) {
    return `${this.publicBaseUrl}${key}`
  }
}

function artifactIndexMarkdown(manifest) {
  const lines = [
    "# Agent Evidence Artifacts",
    "",
    `Repository: ${manifest.repository}`,
    `Issue: #${manifest.issueNumber}`,
    `Reference: ${manifest.reference}`,
    `Generated: ${manifest.generatedAt}`,
    "",
    "## Files",
    "",
  ]

  for (const file of manifest.uploaded) {
    lines.push(`- [${file.path}](${file.url})`)
  }

  return `${lines.join("\n")}\n`
}

function listFiles(directory) {
  const entries = []
  for (const name of readdirSync(directory)) {
    const filePath = path.join(directory, name)
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      entries.push(...listFiles(filePath))
    } else if (stats.isFile()) {
      entries.push(filePath)
    }
  }
  return entries.sort()
}

function objectKeyPrefix({ prefix, reference, repository }) {
  return [prefix, repository, reference].map(normalizeKeyPart).filter(Boolean).join("/")
}

function normalizeKeyPart(value) {
  return String(value ?? "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/")
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === ".json") return "application/json; charset=utf-8"
  if (extension === ".jsonl") return "application/x-ndjson; charset=utf-8"
  if (extension === ".log" || extension === ".txt") return "text/plain; charset=utf-8"
  if (extension === ".md") return "text/markdown; charset=utf-8"
  if (extension === ".png") return "image/png"
  if (extension === ".webm") return "video/webm"
  return "application/octet-stream"
}

function firstEnv(env, ...names) {
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) return value
  }
  return undefined
}

function boolEnv(value, fallback) {
  if (value === undefined) return fallback
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function r2Endpoint(accountId) {
  if (!accountId) return undefined
  return `https://${accountId}.r2.cloudflarestorage.com`
}

async function signRequest({ accessKeyId, body, headers, method, region, secretAccessKey, url }) {
  const { amzDate, dateStamp } = datesFromNow()
  const parsedUrl = new URL(url)
  const payloadHash = await hexHash(body)
  const baseHeaders = {
    ...headers,
    host: parsedUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }
  const { canonicalHeaders, signedHeaders } = canonicalizeHeaders(baseHeaders)
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(parsedUrl.pathname),
    canonicalQueryString(parsedUrl),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  const scope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await hexHash(encoder.encode(canonicalRequest)),
  ].join("\n")
  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region)
  const signature = hex(await hmac(signingKey, stringToSign))

  return {
    headers: {
      ...baseHeaders,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}

function datesFromNow() {
  const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  return { amzDate: iso, dateStamp: iso.slice(0, 8) }
}

function canonicalUri(pathname) {
  return pathname
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/")
}

function canonicalQueryString(url) {
  const pairs = []
  for (const [key, value] of url.searchParams.entries()) {
    pairs.push([encodeRfc3986(key), encodeRfc3986(value)])
  }
  pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
  return pairs.map(([key, value]) => `${key}=${value}`).join("&")
}

function canonicalizeHeaders(headers) {
  const entries = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), String(value).trim().replace(/\s+/g, " ")])
    .sort(([a], [b]) => a.localeCompare(b))
  return {
    canonicalHeaders: `${entries.map(([key, value]) => `${key}:${value}`).join("\n")}\n`,
    signedHeaders: entries.map(([key]) => key).join(";"),
  }
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function encodeKey(value) {
  return encodeRfc3986(value)
}

function encodeObjectKey(value) {
  return value.split("/").map(encodeRfc3986).join("/")
}

async function hexHash(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return hex(digest)
}

async function hmac(key, data) {
  const bytes = key instanceof Uint8Array ? key : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    bytes,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  )
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
}

async function deriveSigningKey(secretAccessKey, dateStamp, region) {
  const dateKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp)
  const regionKey = await hmac(dateKey, region)
  const serviceKey = await hmac(regionKey, "s3")
  return hmac(serviceKey, "aws4_request")
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function toPosixPath(reference) {
  return reference.split(path.sep).join(path.posix.sep)
}
