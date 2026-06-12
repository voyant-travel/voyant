---
"@voyantjs/products-react": minor
---

Add the `./admin` entry: `createProductsAdminExtension` contributes the full products admin routes (list, categories, detail) per the packaged-admin RFC — lazy page hosts (`ProductsHost`, `ProductCategoriesHost`, a packaged default detail page), SSR `data-only` loaders fed by the host runtime, the `ProductsListSkeleton`/`ProductDetailSkeleton` pending components, and route-backed destination annotations (`product.list`, `product.detail`, `productCategory.list`). The detail page exposes a `detailPageComponent` substitution seam for app-owned composition (e.g. the operator passes its wrapper that adds the availability-react option resource templates panel — a dependency cycle from this package — plus its app upload route and a product-pre-selected new-booking deep link). A new `createProductDetailRestApi` builds the `ProductDetailApi` REST transport from a plain `baseUrl` + fetcher pair. No navigation contributed — Products is base-nav-owned.
