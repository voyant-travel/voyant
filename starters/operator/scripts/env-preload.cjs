// Node-native env loading for the `dev` and `start` lanes: load `.env` (if
// present, from the CWD) into process.env before the app boots — the equivalent
// of what wrangler did on Workers. Preloaded with `node -r ./scripts/env-preload.cjs`
// so it works across the whole supported Node range (>=20): `--require` is
// always available, `process.loadEnvFile` is used when present (Node 20.12+) and
// no-ops otherwise, and the call never overwrites already-set / platform env.
// Real deployments have no `.env`, so this is a no-op there.
try {
  process.loadEnvFile?.(".env")
} catch {
  // no `.env` file — rely on the ambient process.env
}
