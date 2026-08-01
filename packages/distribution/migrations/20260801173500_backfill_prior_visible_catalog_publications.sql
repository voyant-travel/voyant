-- Seed one durable, resumable backfill instead of synchronously materializing
-- active-channels x public-products during deploy. The publication intent
-- worker owns bounded product pages, persists its cursor, and replays safely.
INSERT INTO "channel_publication_reindex_intents" (
	"id",
	"channel_id",
	"kind",
	"status",
	"requested_by",
	"metadata"
)
VALUES (
	'cpri_prior_visible_catalog_backfill',
	NULL,
	'catalog',
	'pending',
	'system:migration:20260801173500_backfill_prior_visible_catalog_publications',
	jsonb_build_object(
		'source', 'prior_active_public_catalog',
		'pageSizeOwnedBy', 'distribution-publication-intent-worker'
	)
)
ON CONFLICT DO NOTHING;
