# @voyantjs/voyant-typescript-config

Shared TypeScript configuration for the Voyant workspace. Base `tsconfig.json` that package-level `tsconfig.json` files extend from.

## Install

```bash
pnpm add -D @voyantjs/voyant-typescript-config
```

## Usage

```json
{
  "extends": "@voyantjs/voyant-typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

## License

Apache-2.0
