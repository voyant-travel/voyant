---
"@voyantjs/products": patch
"@voyantjs/extras": patch
"@voyantjs/cruises": patch
"@voyantjs/charters": patch
"@voyantjs/hospitality": patch
---

Fix #492: expose all workspace sub-paths in `publishConfig.exports` for vertical packages.

`publishConfig.exports` (used at publish time) had drifted from the workspace `exports` map: catalog plane and content plane sub-paths shipped in `dist/` but were unreachable from the published package. Consumers installing from npm hit `ERR_PACKAGE_PATH_NOT_EXPORTED` / `TS2307` when importing them.

Newly exposed sub-paths:

- `@voyantjs/products`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
- `@voyantjs/extras`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
- `@voyantjs/cruises`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
- `@voyantjs/charters`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
- `@voyantjs/hospitality`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./draft-shape`
