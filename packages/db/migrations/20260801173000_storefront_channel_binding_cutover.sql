CREATE TABLE IF NOT EXISTS "auth_storefront_distribution_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"storefront_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_storefront_distribution_channel_pair_idx"
	ON "auth_storefront_distribution_channel" ("storefront_id", "channel_id")
	WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_storefront_distribution_channel_l_uniq"
	ON "auth_storefront_distribution_channel" ("storefront_id")
	WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_storefront_distribution_channel_r_idx"
	ON "auth_storefront_distribution_channel" ("channel_id")
	WHERE "deleted_at" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		WITH origins AS (
			SELECT
				s.id AS storefront_id,
				origin.value AS origin
			FROM "storefronts" s
			CROSS JOIN LATERAL jsonb_array_elements_text(s.allowed_origins) AS origin(value)
		)
		SELECT 1
		FROM origins left_origin
		JOIN origins right_origin
			ON left_origin.storefront_id < right_origin.storefront_id
		WHERE
			left_origin.origin = right_origin.origin
			OR (
				left_origin.origin LIKE 'https://*.%'
				AND right_origin.origin NOT LIKE 'https://*.%'
				AND split_part(substring(right_origin.origin from 9), ':', 1)
					LIKE '%.' || substring(left_origin.origin from 11)
				AND strpos(
					left(
						split_part(substring(right_origin.origin from 9), ':', 1),
						length(split_part(substring(right_origin.origin from 9), ':', 1))
							- length(substring(left_origin.origin from 11)) - 1
					),
					'.'
				) = 0
			)
			OR (
				right_origin.origin LIKE 'https://*.%'
				AND left_origin.origin NOT LIKE 'https://*.%'
				AND split_part(substring(left_origin.origin from 9), ':', 1)
					LIKE '%.' || substring(right_origin.origin from 11)
				AND strpos(
					left(
						split_part(substring(left_origin.origin from 9), ':', 1),
						length(split_part(substring(left_origin.origin from 9), ':', 1))
							- length(substring(right_origin.origin from 11)) - 1
					),
					'.'
				) = 0
			)
			OR (
				left_origin.origin LIKE 'https://*.%'
				AND right_origin.origin LIKE 'https://*.%'
				AND replace(left_origin.origin, 'https://*.', '') = replace(right_origin.origin, 'https://*.', '')
			)
	) THEN
		RAISE EXCEPTION 'storefront allowed origins overlap across storefronts';
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.channels') IS NULL THEN
		RAISE EXCEPTION 'storefront channel binding cutover requires the channels table';
	END IF;

	EXECUTE $sql$
		INSERT INTO "channels" (
			"id",
			"name",
			"description",
			"kind",
			"status",
			"metadata"
		)
		SELECT
			'chan_storefront_direct',
			'Storefront Direct',
			'Backfilled direct channel for storefront fail-closed cutover.',
			'direct',
			'active',
			jsonb_build_object(
				'source', 'system:migration:20260801173000_storefront_channel_binding_cutover'
			)
		WHERE NOT EXISTS (
			SELECT 1
			FROM "channels"
			WHERE "kind" = 'direct'
		)
	$sql$;
END $$;
--> statement-breakpoint
DO $$
DECLARE
	direct_channel_id text;
BEGIN
	SELECT id
	INTO direct_channel_id
	FROM "channels"
	WHERE "kind" = 'direct'
		AND "status" = 'active'
	ORDER BY "created_at", "id"
	LIMIT 1;

	IF direct_channel_id IS NULL THEN
		RAISE EXCEPTION 'cannot backfill storefront channel bindings without an active direct channel';
	END IF;

	INSERT INTO "auth_storefront_distribution_channel" (
		"id",
		"storefront_id",
		"channel_id",
		"created_at",
		"updated_at",
		"deleted_at"
	)
	SELECT
		'lnk_sfchan_' || substr(md5(s.id || direct_channel_id), 1, 20),
		s.id,
		direct_channel_id,
		now(),
		now(),
		NULL
	FROM "storefronts" s
	WHERE NOT EXISTS (
		SELECT 1
		FROM "auth_storefront_distribution_channel" binding
		WHERE binding."storefront_id" = s.id
			AND binding."deleted_at" IS NULL
	)
	ON CONFLICT DO NOTHING;

	IF EXISTS (
		SELECT 1
		FROM "storefronts" s
		WHERE NOT EXISTS (
			SELECT 1
			FROM "auth_storefront_distribution_channel" binding
			JOIN "channels" c ON c.id = binding."channel_id"
			WHERE binding."storefront_id" = s.id
				AND binding."deleted_at" IS NULL
				AND c."status" = 'active'
		)
	) THEN
		RAISE EXCEPTION 'storefront channel binding cutover left unbound or inactive storefronts';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "auth_storefront_distribution_channel"
		WHERE "deleted_at" IS NULL
		GROUP BY "storefront_id"
		HAVING count(DISTINCT "channel_id") > 1
	) THEN
		RAISE EXCEPTION 'storefront channel binding cutover found multiple active bindings';
	END IF;
END $$;
