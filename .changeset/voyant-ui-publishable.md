---
"@voyantjs/voyant-ui": minor
---

`@voyantjs/voyant-ui` is now publishable. Consumers can `pnpm add @voyantjs/voyant-ui` and import primitives directly instead of copying them via the shadcn registry — updates flow with version bumps. The registry path remains for components you intend to fork.

**What changed:**

- `private: true` flipped to publishable; package removed from changesets `ignore` and added to the linked release group.
- New `tsconfig.build.json` emits `dist/` (JS + `.d.ts` + declaration maps) under `module: ESNext` / `moduleResolution: Bundler`. The package is bundler-consumed by design.
- New `build`, `clean`, `prepack`, `typecheck` scripts. `prepack` runs the build so `pnpm pack` produces a complete tarball.
- `publishConfig.exports` mirrors the dev `exports` map but points at `./dist/*.js` + `./dist/*.d.ts`. Workspace consumers continue to resolve `./src/*` directly; only published consumers see the dist paths.
- `files: ["dist", "src/styles", "postcss.config.mjs"]` — `globals.css` ships as-is for consumers to import.
- Editor `tsconfig.json` aligned to `Bundler` resolution to match the build (avoids extensionless-import false positives in `tsc --noEmit`).
- One latent type bug in `input-group.tsx` fixed (`querySelector` lacked an explicit element-type narrowing).

**Tree-shaking:** `sideEffects: false` is set across all UI/react packages in this repo, so unused named exports drop through barrels in modern bundlers.
