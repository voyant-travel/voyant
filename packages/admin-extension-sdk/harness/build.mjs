// Dev-only harness bundler. Bundles the demo extension and the real
// UiExtensionHost (from @voyant-travel/admin source) so the host can be driven
// in a browser. Not part of the package build.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, "../../..")
const OUT = resolve(HERE, "public")

// esbuild lives in the pnpm store; locate its main module without depending on
// hoisting.
const pnpmDir = resolve(REPO, "node_modules/.pnpm")
const esbuildPkg = readdirSync(pnpmDir).find((name) => /^esbuild@\d/.test(name))
if (!esbuildPkg) throw new Error("could not find esbuild in the pnpm store")
const esbuild = require(resolve(pnpmDir, esbuildPkg, "node_modules/esbuild/lib/main.js"))

// esbuild does not rewrite `./foo.js` specifiers onto their `.ts`/`.tsx`
// source; the js-to-ts plugin does so for the workspace source we bundle.
const jsToTs = {
  name: "js-to-ts",
  setup(build) {
    build.onResolve({ filter: /^\.\.?\/.*\.js$/ }, (args) => {
      const base = resolve(args.resolveDir, args.path)
      for (const candidate of [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx")]) {
        if (existsSync(candidate)) return { path: candidate }
      }
      return undefined
    })
  },
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(resolve(OUT, "extension"), { recursive: true })

const shared = {
  bundle: true,
  platform: "browser",
  plugins: [jsToTs],
  // Resolve bare deps (react, @voyant-travel/*) for the harness entry files,
  // which sit outside a node_modules chain that carries them.
  nodePaths: [resolve(REPO, "packages/admin/node_modules")],
  loader: { ".ts": "ts", ".tsx": "tsx" },
  logLevel: "info",
}

// Host page: an ES module loaded by the same-origin top document.
await esbuild.build({
  ...shared,
  format: "esm",
  entryPoints: [resolve(HERE, "host/main.tsx")],
  outfile: resolve(OUT, "host.js"),
  jsx: "automatic",
})

// Extension: a CLASSIC (IIFE) bundle. The frame runs in an opaque-origin
// sandbox (no `allow-same-origin`), where `<script type="module">` cannot be
// fetched — real extensions ship a classic bundle or serve modules with CORS.
await esbuild.build({
  ...shared,
  format: "iife",
  entryPoints: [resolve(HERE, "extension/main.ts")],
  outfile: resolve(OUT, "extension/extension.js"),
})

cpSync(resolve(HERE, "host/index.html"), resolve(OUT, "index.html"))
cpSync(resolve(HERE, "extension/index.html"), resolve(OUT, "extension/index.html"))
cpSync(resolve(HERE, "extension/silent.html"), resolve(OUT, "extension/silent.html"))

// Sanity: the built extension bundle must include the SDK handshake.
if (!readFileSync(resolve(OUT, "extension/extension.js"), "utf8").includes("voyant:ext:ready")) {
  throw new Error("extension bundle is missing the SDK handshake")
}
console.log(`harness built → ${OUT}`)
