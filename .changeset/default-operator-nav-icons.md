---
"@voyant-travel/admin": minor
---

New `defaultOperatorNavIcons` export — the standard operator nav icon set (the 15 standard lucide icons), shipped by the framework so deployments stop hand-wiring lucide imports + an icon map. Use `icons={defaultOperatorNavIcons}` directly, or spread to override a single entry (`{ ...defaultOperatorNavIcons, finance: MyIcon }`). First slice of consolidated-deployments Workstream C (admin chrome derivation).
