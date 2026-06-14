# Operator Seeder

`apps/scripts/src/seed-operator.ts` generates realistic operator data with Gemini and Unsplash, then writes it into the operator starter database.

## Usage

From the repo root:

```bash
pnpm seed:operator
```

Common flags:

```bash
pnpm seed:operator -- --label april-demo --scale large
pnpm seed:operator -- --theme "Luxury Danube and Adriatic escapes"
pnpm seed:operator -- --owner-email admin@example.com
pnpm seed:operator -- --no-images
pnpm seed:operator -- --dry-run
```

## Required Environment

The script loads env vars from:

1. `.env`
2. `.env.local`
3. `starters/operator/.env`
4. `starters/operator/.env.local`

Required variables:

- `DATABASE_URL`
- `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY`

Optional variables:

- `UNSPLASH_ACCESS_KEY`

If `UNSPLASH_ACCESS_KEY` is not present, the script still seeds the database but skips product media images.
