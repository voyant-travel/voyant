-- Seed one durable, resumable backfill instead of synchronously materializing
-- active-channels x public-products during deploy. Two linear snapshot sets
-- preserve exact cutover eligibility without materializing the cross-product;
-- the worker pages each immutable set independently and replays safely.
CREATE TABLE "channel_publication_backfill_products" (
	"intent_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "channel_publication_backfill_products_intent_id_product_id_pk" PRIMARY KEY("intent_id", "product_id")
);
--> statement-breakpoint
CREATE TABLE "channel_publication_backfill_channels" (
	"intent_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "channel_publication_backfill_channels_intent_id_channel_id_pk" PRIMARY KEY("intent_id", "channel_id")
);
--> statement-breakpoint
ALTER TABLE "channel_publication_backfill_products"
	ADD CONSTRAINT "channel_publication_backfill_products_intent_id_fk"
	FOREIGN KEY ("intent_id") REFERENCES "channel_publication_reindex_intents"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "channel_publication_backfill_channels"
	ADD CONSTRAINT "channel_publication_backfill_channels_intent_id_fk"
	FOREIGN KEY ("intent_id") REFERENCES "channel_publication_reindex_intents"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "channel_publication_backfill_channels"
	ADD CONSTRAINT "channel_publication_backfill_channels_channel_id_fk"
	FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE cascade;
--> statement-breakpoint
WITH "backfill_intent" AS (
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
			'pageSizeOwnedBy', 'distribution-publication-intent-worker',
			'snapshotVersion', 'linear-v1'
		)
	)
	ON CONFLICT DO NOTHING
	RETURNING "id"
),
"product_snapshot" AS (
	INSERT INTO "channel_publication_backfill_products" ("intent_id", "product_id")
	SELECT "backfill_intent"."id", "products"."id"
	FROM "backfill_intent", "products"
	WHERE "products"."status" = 'active'
		AND "products"."visibility" = 'public'
	ON CONFLICT DO NOTHING
	RETURNING "product_id"
),
"channel_snapshot" AS (
	INSERT INTO "channel_publication_backfill_channels" ("intent_id", "channel_id")
	SELECT "backfill_intent"."id", "channels"."id"
	FROM "backfill_intent", "channels"
	WHERE "channels"."status" = 'active'
	ON CONFLICT DO NOTHING
	RETURNING "channel_id"
)
UPDATE "channel_publication_reindex_intents"
SET "metadata" = "metadata" || jsonb_build_object(
	'productSnapshotCount', (SELECT count(*) FROM "product_snapshot"),
	'channelSnapshotCount', (SELECT count(*) FROM "channel_snapshot")
)
WHERE "id" IN (SELECT "id" FROM "backfill_intent");
