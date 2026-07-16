---
"@voyant-travel/framework": patch
---

The typesense search provider's deployment requirements now advertise the optional `TYPESENSE_COLLECTION_PREFIX` variable, so requirement-driven env provisioning surfaces it alongside `TYPESENSE_HOST` and `TYPESENSE_API_KEY`.
