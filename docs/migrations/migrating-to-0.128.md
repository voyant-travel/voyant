# Migrating Auth to 0.128

Breaking-change notes for `@voyant-travel/auth@0.128.0`.

## TL;DR

- Move `createBetterAuth({ useSecureCookies })` to
  `createBetterAuth({ advanced: { useSecureCookies } })`.
- Merge the setting into an existing `advanced` object when one is present.
- Secure cookies remain enabled by default outside explicit local development.
- Local development remains non-secure by default.
- No database or HTTP route migration is required.

## Schema changes

None.

## Removed exports

None. This release removes an option from the public `CreateBetterAuthOptions`
shape rather than removing an exported symbol.

## HTTP route changes

None.

## Hook signature changes

None.

## Caller-code migrations

Move the Better Auth setting under `advanced`:

```ts
// Before: @voyant-travel/auth@0.127.x
createBetterAuth({
  useSecureCookies: false,
})

// After: @voyant-travel/auth@0.128.x
createBetterAuth({
  advanced: {
    useSecureCookies: false,
  },
})
```

When other advanced options already exist, preserve them in the same object:

```ts
createBetterAuth({
  advanced: {
    ...existingAdvancedOptions,
    useSecureCookies: false,
  },
})
```

Omitting the option preserves the existing defaults: secure cookies are used
outside explicit local development, while `NODE_ENV=development` defaults to
non-secure cookies.

## Per-package CHANGELOGs

- [`@voyant-travel/auth@0.128.0`](../../packages/auth/CHANGELOG.md)
