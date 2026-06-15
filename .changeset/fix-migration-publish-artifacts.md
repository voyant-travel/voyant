---
"@voyant-travel/distribution": patch
"@voyant-travel/auth": patch
"@voyant-travel/products-contracts": patch
"@voyant-travel/suppliers-contracts": patch
"@voyant-travel/utils": patch
"@voyant-travel/ui": patch
---

Fix migration-facing publish artifacts by exporting all Distribution-owned supplier and external-reference schemas, republishing contract packages with complete dist files, guarding packed artifacts against legacy package-scope specifiers, and updating Voyant Cloud defaults to `https://api.voyant.travel`.
