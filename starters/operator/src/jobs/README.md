# Deployment jobs

Put low-level deployment maintenance jobs in `src/jobs/**/*.ts`. Product work
that needs a public durable schedule should declare `schedule` on a workflow
instead.

```ts
// src/jobs/reconcile-search.ts
export const schedule = { cron: "0 3 * * *" }

export default async function reconcileSearch(): Promise<void> {
  // Run deployment-local maintenance work.
}
```

Each file must export a durable static `schedule` and default-export its
handler. Type-only exports are allowed; other runtime exports are rejected. Job
IDs are path-derived (the example becomes `project.job.reconcile-search`), and
the compiler wraps each job in a workflow in
`.voyant/runtime/project-jobs.generated.ts`.

Every non-declaration `.ts` file below this directory is a convention entry, so
keep helpers and tests elsewhere unless they also satisfy the job contract.
