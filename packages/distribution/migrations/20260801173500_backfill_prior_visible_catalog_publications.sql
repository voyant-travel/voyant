-- Seed one durable, resumable backfill instead of synchronously materializing
-- active-channels x public-products during deploy. The publication intent
-- worker owns bounded product pages, persists its cursor, and replays safely.
WITH "cutover" AS MATERIALIZED (
	SELECT clock_timestamp() AS "at"
),
"product_bound" AS (
	SELECT "products"."id", "products"."created_at"
	FROM "products", "cutover"
	WHERE "products"."created_at" <= "cutover"."at"
	ORDER BY "products"."created_at" DESC, "products"."id" DESC
	LIMIT 1
),
"channel_bound" AS (
	SELECT "channels"."id", "channels"."created_at"
	FROM "channels", "cutover"
	WHERE "channels"."created_at" <= "cutover"."at"
	ORDER BY "channels"."created_at" DESC, "channels"."id" DESC
	LIMIT 1
)
INSERT INTO "channel_publication_reindex_intents" (
	"id",
	"channel_id",
	"kind",
	"status",
	"requested_by",
	"metadata"
)
SELECT
	'cpri_prior_visible_catalog_backfill',
	NULL,
	'catalog',
	'pending',
	'system:migration:20260801173500_backfill_prior_visible_catalog_publications',
	jsonb_build_object(
		'source', 'prior_active_public_catalog',
		'pageSizeOwnedBy', 'distribution-publication-intent-worker',
		'cutover', jsonb_build_object(
			'at', "cutover"."at",
			'product', CASE WHEN "product_bound"."id" IS NULL THEN NULL ELSE jsonb_build_object(
				'id', "product_bound"."id",
				'createdAt', "product_bound"."created_at"
			) END,
			'channel', CASE WHEN "channel_bound"."id" IS NULL THEN NULL ELSE jsonb_build_object(
				'id', "channel_bound"."id",
				'createdAt', "channel_bound"."created_at"
			) END
		)
	)
FROM "cutover"
LEFT JOIN "product_bound" ON true
LEFT JOIN "channel_bound" ON true
ON CONFLICT DO NOTHING;
