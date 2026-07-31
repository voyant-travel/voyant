# Operator Docker image: does it build and boot?

Investigation of `starters/operator/Dockerfile` as the shippable operator
deliverable. All work done on lab1 with throwaway local resources. Every claim
below is backed by a captured log in this directory.

## TL;DR

| Question | Answer |
|---|---|
| Does the image build? | **Yes.** ~2m30s wall clock, 1.5 GB final image, build exit 0. |
| Does it boot? | **No.** Crashes immediately (`exit 1`) before reading any env — `Cannot find package 'tsx'`. |
| How do migrations reach the DB? | **There is no supported path.** The runtime image has no CLI, no migration SQL, no `.voyant` artifacts. I migrated by hand-reconstructing the plan from build artifacts. |
| Same image, second config? | **Serves neither.** All three configs (`KMS=local`, `KMS=env`, `voyant-cloud`) crash identically, config-independent. |
| Biggest obstacle to shipping? | The server bundle resolves workspace-package **source** (`@voyant-travel/*/src/*.ts`) + `tsx` at **runtime**, but `pnpm deploy --prod` ships neither. The image is structurally incapable of booting. |

What I ran vs inferred: I **ran** the build, the Postgres, the migration
reconstruction+apply, and four container boots (self-hosted, KMS=env,
voyant-cloud, tsx-patched probe). I did **not** reach tasks 5 (HTTP exercise) —
the server never binds a port, so there is nothing to curl. That is a
consequence of the boot failure, reported plainly, not skipped.

---

## 1. Build — PASS

```
docker build -f starters/operator/Dockerfile -t voyant-operator .
```

- Exit status: **0** (`build.log`, last line `BUILD EXIT 0`).
- Wall clock: **2:29.67** (`/usr/bin/time -v`).
- Final image: **1.5 GB** (`docker images voyant-operator`).
- `voyant build` inside the build stage succeeded and reported `migrations 31`,
  emitting `dist/client` + `dist/server/server.js` (3.78 MB, gzip 558 kB).

Stage / layer sizes (`docker history voyant-operator`):

| Layer | Size |
|---|---|
| base `node:22-slim` (debian + node + yarn) | ~247 MB |
| `COPY /deploy/node_modules` (prod deps) | **959 MB** |
| `COPY dist` | 55.5 MB |
| `COPY package.json` | 16 kB |

The build is not the problem. Notably `scripts/check-operator-docker-target.mjs`
(the only "check" that exists) never builds or runs the image — it string-matches
the Dockerfile text, so a green check here means nothing about whether the
artifact works.

## 2. Throwaway Postgres

```
docker run -d --name voyant-op-pg -e POSTGRES_PASSWORD=throwaway \
  -e POSTGRES_USER=voyant -e POSTGRES_DB=voyant_operator -p 55433:5432 postgres:16
```

Connection string used:
`postgresql://voyant:throwaway@voyant-op-pg:5432/voyant_operator`
(host port 55433; container-to-container on a user-defined bridge `voyant-op-net`).

## 3. How migrations reach the database — **NO SUPPORTED PATH (major finding)**

The operator's migrate command is `voyant migrate` (`@voyant-travel/cli`, a
**devDependency**). I confirmed by inspecting the built runtime image:

```
$ docker run --rm --entrypoint sh voyant-operator -c '...'
node_modules/@voyant-travel/cli   -> does not exist
node_modules/.bin (voyant)        -> does not exist
find node_modules -name migrations-> 0 dirs
/app/.voyant                      -> does not exist
find dist -name '*.sql'           -> 0 files
```

So from the shipped image a self-hoster **cannot** migrate: the CLI, the
migration SQL, and the generated migration plan are all absent. The runtime
server does **not** auto-migrate on boot either (no `runMigrations`/
`applyMigrations` in `packages/runtime/src`).

The only place `voyant migrate` exists is the **build stage** (full workspace +
devDeps). I ran it there — **it also fails** (`migrate.log`):

```
voyant migrate: Cannot find module '/repo/packages/framework/src/operator-distribution.js'
  imported from /repo/packages/framework/src/project.ts
MIGRATE_EXIT=1
```

`operator-distribution.ts` exists (a source-only barrel:
`export * from "@voyant-travel/operator-standard"`), but `project.ts` imports it
as `./operator-distribution.js`. Under the CLI's Node loader the relative
`.js`→`.ts` specifier for a source-only file is not remapped, so migrate dies
before touching the DB. This is reproducible (verified twice, `MIGRATE_EXIT=1`).

**How I actually got the schema in (not a supported path — a reconstruction):**
I extracted `starters/operator/.voyant/migration-plan.generated.json` out of the
build stage, mapped each of the 30 ordered `schema` entries to its
`packages/*/migrations` drizzle folder, concatenated the 110 SQL files in
journal order, and applied them with `psql`:

```
docker exec -i voyant-op-pg psql -v ON_ERROR_STOP=1 -U voyant -d voyant_operator < all-migrations.sql
PSQL_EXIT=0   -> 433 tables created, 0 errors
```

That worked, but it is emphatically **not** a path any self-hoster has: it
required the monorepo checkout, the build stage, a JSON plan not shipped in the
image, and a bespoke script. **The migration story for this image is broken.**

## 4. Boot — **FAIL (does not boot in any configuration)**

```
docker run --rm -p 18080:8080 --env-file <self-hosted env> voyant-operator
```

Result: **exit 1 within ~1s** (`boot-selfhosted.log`):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx'
  imported from /app/dist/server/server.js
```

- `dist/server/server.js` statically imports `tsx/esm/api` (125 references).
- `tsx` is a **devDependency** of the operator, so `pnpm deploy --prod` strips
  it. `node_modules/tsx` is absent from the runtime image.
- The crash is at ESM link time, **before any application code or env
  validation runs** — so no env value can fix it.

**Minimum env set:** cannot be determined empirically. The documented
self-hosted env (`env-minimal.txt`) was constructed from `.env.example`, but the
process dies before env is read, so "remove a var and see if it still boots" is
not observable. The env contract deliverable is therefore **unverifiable against
a running server** for this image.

## 5. Exercise over HTTP — **NOT REACHED**

The server never binds `:8080`, so `GET /healthz` and `/v1/admin/*` could not be
exercised. Reported as a consequence of §4, not skipped.

## 6. Same image, different configuration — **serves NEITHER audience**

The product claim is "one image, both audiences by configuration". I ran the
same image three ways without rebuilding:

| Config | Log | Result |
|---|---|---|
| self-hosted `KMS=local` | `boot-selfhosted.log` | `ERR_MODULE_NOT_FOUND: tsx`, exit 1 |
| `KMS=env` + `KMS_ENV_KEY` | `boot-variant.log` | identical crash, exit 1 |
| `voyant-cloud` + placeholder cloud URLs | `boot-variant-cloud.log` | identical crash, exit 1 |

The failure is **config-independent**: it happens before the KMS provider or
auth mode is ever consulted. So the image serves neither audience today, and the
config-switching claim can't even be tested. (A clean validation failure on the
cloud placeholders would have been a *good* result — instead we get the same
pre-flight module crash for all three.)

**How deep does it go? (diagnostic probe, not a fix.)** I built a throwaway
derived image adding `tsx` (`boot-probe-tsx.log`) to see whether tsx is the only
blocker. It is not — the next crash is:

```
Error: Cannot find module '/app/node_modules/@voyant-travel/runtime/src/index.ts'
  at createBundledDocumentRenderer (dist/server/server.js)
  code: 'MODULE_NOT_FOUND'
```

Inspecting the prod image, `@voyant-travel/runtime`'s `package.json` exports
point only at source:

```
".": "./src/index.ts",  "./openapi": "./src/openapi.ts", ...
```

…but the deployed package contains **no `src/`** — only `README.md`,
`package.json`, and nested `node_modules`. All `@voyant-travel/*` packages
together are **128 KB** in the image (empty shells). The bundle has **1104**
`/src/` runtime references. So the operator is built with the `development`
resolve condition (bundle workspace packages from source) yet still emits
runtime `require.resolve(...src/index.ts)` + tsx-loader calls, which cannot
resolve once the source is gone. Patching tsx alone would not boot it; the image
would need the full TypeScript source of 30+ workspace packages plus a TS loader
plus the correct resolve condition.

## 7. Single biggest obstacle to shipping

**The runtime bundle depends on workspace-package source `.ts` files and the
`tsx` loader at run time, but the production image (`pnpm deploy --prod`) ships
neither.** Concretely, in order of what a fix must address:

1. `dist/server/server.js` imports `tsx/esm/api`; `tsx` is a devDependency →
   stripped from the prod image → immediate boot crash.
2. Even with tsx present, the bundle resolves `@voyant-travel/*/src/*.ts` at
   runtime; those source files (and the `development` export condition they rely
   on) are absent from the prod image.
3. Separately, migrations have no path onto the image at all, and the build-stage
   `voyant migrate` fallback is itself broken.

The image builds green and the lone "check" is a text match, which is exactly
how this shipped without anyone noticing it has never booted.

---

## Reproduction / evidence index

- `build.log` — full `docker build` output (exit 0, timing).
- `migrate.log` — build-stage `voyant migrate` failure + `.voyant` extraction.
- `boot-selfhosted.log` — self-hosted `KMS=local` boot crash.
- `boot-variant.log` — `KMS=env` boot crash (same image, no rebuild).
- `boot-variant-cloud.log` — `voyant-cloud` boot crash (same image, no rebuild).
- `boot-probe-tsx.log` — tsx-patched probe exposing the second (source) blocker.
- `env-minimal.txt` — the constructed self-hosted env (secrets redacted;
  unverified against a running server because boot fails first).
</content>
