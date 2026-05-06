---
"@voyantjs/plugin-smartbill": minor
---

Add a supported local SmartBill mock for safe development and end-to-end billing tests.

The new `@voyantjs/plugin-smartbill/mock` entrypoint exposes a stateful
SmartBill-compatible mock with in-process `fetch`, a localhost HTTP listener,
deterministic document numbering, PDF URLs marked as test documents, invoice
status changes, and proforma conversion polling.
