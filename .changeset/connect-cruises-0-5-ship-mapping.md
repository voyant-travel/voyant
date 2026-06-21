---
"@voyant-travel/plugin-voyant-connect": patch
---

Bump `@voyant-travel/connect-cruises` to `0.5.0` and drop the blanket `as CruiseAdapter` cast (#1976, connect-sdk#81).

`connect-cruises@0.5.0` aligned the price-component `kind` union, so the cast is no longer needed to bridge it. Removing the cast surfaced a divergence it had been hiding: `fetchShip` carries deck plan art as `imageUrl` while the cruise vertical reads `planImageUrl`, so deck plans were silently dropping out of sourced cruise content. Replaced the cast with a typed `conformConnectCruiseAdapter` seam that maps the deck field, drops unnamed decks, and coerces nullable cabin-category fields — fixing the dropped deck plans. Remaining ship-shape alignment is tracked upstream in connect-sdk#81.
