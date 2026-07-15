// Dev-only static server for the harness build. Serves harness/public on 5271.
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "public")
const PORT = 5271

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
}

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0])
  let filePath = join(ROOT, clean)
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html")
  }
  return filePath
}

createServer((req, res) => {
  const filePath = resolvePath(req.url ?? "/")
  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    res.writeHead(404)
    res.end("not found")
    return
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(filePath)] ?? "application/octet-stream",
  })
  createReadStream(filePath).pipe(res)
}).listen(PORT, () => {
  console.log(`harness serving ${ROOT} on http://localhost:${PORT}`)
})
