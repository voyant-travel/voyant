---
"@voyant-travel/inventory": minor
---

Add a themed product brochure HTML renderer and printer decorator. Brochure
template context now includes product media and pax pricing tiers so custom
brochure layouts can render covers, galleries, and pricing tables without
extra app-local queries, while still replacing the section set for fully custom
brochure designs. The themed printer requires an HTML-capable browser printer
and guards against accidental composition with the built-in basic PDF printer.
