---
"@voyant-travel/inventory-react": minor
---

Wire the media library into product and itinerary-day media management. The
"Upload" action on the product detail gallery and the itinerary-day media tray
now opens the media library picker — a dialog where you can select existing
assets or upload new ones — instead of a bare file input. Selected assets are
linked to the product/day (`assetId`) and served through the shared media
byte route so uploads surface in the library and vice versa.
