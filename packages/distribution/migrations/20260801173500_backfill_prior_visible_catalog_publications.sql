INSERT INTO "channel_product_publications" (
	"id",
	"channel_id",
	"product_id",
	"decision",
	"reason",
	"created_by",
	"updated_by",
	"metadata"
)
SELECT
	'chpp_visible_' || substr(md5(c.id || ':' || p.id), 1, 20),
	c.id,
	p.id,
	'include',
	'Backfilled from prior active public catalog visibility during publication cutover.',
	'system:migration:20260801173500_backfill_prior_visible_catalog_publications',
	'system:migration:20260801173500_backfill_prior_visible_catalog_publications',
	jsonb_build_object(
		'source', 'prior_active_public_catalog',
		'productStatus', p.status,
		'productVisibility', p.visibility
	)
FROM "channels" c
CROSS JOIN "products" p
WHERE c."status" = 'active'
	AND p."status" = 'active'
	AND p."visibility" = 'public'
ON CONFLICT ("channel_id", "product_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "channel_publication_reindex_intents" (
	"id",
	"channel_id",
	"kind",
	"product_id",
	"status",
	"requested_by",
	"metadata"
)
SELECT
	'cpri_visible_' || substr(md5(c.id || ':' || p.id), 1, 20),
	c.id,
	'product',
	p.id,
	'pending',
	'system:migration:20260801173500_backfill_prior_visible_catalog_publications',
	jsonb_build_object(
		'source', 'prior_active_public_catalog',
		'productStatus', p.status,
		'productVisibility', p.visibility
	)
FROM "channels" c
CROSS JOIN "products" p
WHERE c."status" = 'active'
	AND p."status" = 'active'
	AND p."visibility" = 'public'
ON CONFLICT DO NOTHING;
