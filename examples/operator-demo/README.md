# Operator Demo Fixture

This example owns the destructive, product-specific seed data used for local
Voyant product demonstrations. It is intentionally separate from the standard
Operator starter: generated projects begin with an empty `src/scripts/seed.ts`
and should contain only their own data.

From the repository root, after migrating the selected project graph:

```bash
pnpm --filter @voyant-travel/example-operator-demo seed -- --confirm
```

The command reads `DATABASE_URL` from the environment or from the repository and
checked-in Operator `.env` files. It truncates the tables it owns before
inserting the fixture, so never run it against a database containing real data.

For an AI-generated demo dataset, set `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY`
and run:

```bash
pnpm --filter @voyant-travel/example-operator-demo seed:generated
```

The generated-data command accepts `--label`, `--scale`, `--theme`,
`--owner-email`, `--no-images`, and `--dry-run`. `UNSPLASH_ACCESS_KEY` is
optional.
