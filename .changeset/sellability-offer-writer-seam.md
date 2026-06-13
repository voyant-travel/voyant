---
"@voyantjs/sellability": patch
"@voyantjs/commerce": patch
---

Remove Sellability's runtime dependency on Transactions by introducing an
explicit offer writer seam for construct-offer materialization. Commerce runtime
composition can now pass Sellability route options while host deployments wire
legacy Transactions adapters at the boundary.
