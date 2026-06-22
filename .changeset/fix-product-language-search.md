---
"@voyant-travel/inventory-react": patch
---

Fix the product translation language picker so the "Add language" search box
filters as you type. `LanguageCombobox` now feeds its options to the underlying
combobox via `items` + `ComboboxCollection` with a `filter` that matches on both
the language name and code, instead of rendering the full unfiltered list.
