-- Move legacy EAV values into the unified entity-owned jsonb columns before
-- retiring custom_field_values. This is deliberately package-owned and
-- post-cutline so existing deployments receive it automatically.
DO $$
DECLARE
  entity record;
  legacy_count bigint;
  missing_count bigint;
  unknown_types text;
BEGIN
  IF to_regclass('public.custom_field_values') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(DISTINCT entity_type::text, ', ' ORDER BY entity_type::text)
    INTO unknown_types
    FROM custom_field_values
   WHERE entity_type::text NOT IN ('person', 'organization', 'activity', 'quote');

  IF unknown_types IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot retire custom_field_values: unsupported entity types: %',
      unknown_types;
  END IF;

  SELECT count(*)
    INTO missing_count
    FROM custom_field_values v
    LEFT JOIN custom_field_definitions d ON d.id = v.definition_id
   WHERE d.id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'Cannot retire custom_field_values: % row(s) reference missing definitions',
      missing_count;
  END IF;

  FOR entity IN
    SELECT *
      FROM (VALUES
        ('person', 'people'),
        ('organization', 'organizations'),
        ('activity', 'activities'),
        ('quote', 'quotes')
      ) AS targets(entity_type, table_name)
  LOOP
    SELECT count(*)
      INTO legacy_count
      FROM custom_field_values
     WHERE entity_type::text = entity.entity_type;

    IF legacy_count = 0 THEN
      CONTINUE;
    END IF;

    IF to_regclass(format('public.%I', entity.table_name)) IS NULL THEN
      RAISE EXCEPTION
        'Cannot retire custom_field_values: target table % is missing for % legacy row(s)',
        entity.table_name,
        legacy_count;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = entity.table_name
         AND column_name = 'custom_fields'
    ) THEN
      RAISE EXCEPTION
        'Cannot retire custom_field_values: %.custom_fields is missing',
        entity.table_name;
    END IF;

    EXECUTE format(
      'SELECT count(*)
         FROM custom_field_values v
         LEFT JOIN %I t ON t.id = v.entity_id
        WHERE v.entity_type::text = $1
          AND t.id IS NULL',
      entity.table_name
    )
      INTO missing_count
      USING entity.entity_type;

    IF missing_count > 0 THEN
      RAISE EXCEPTION
        'Cannot retire custom_field_values: % % row(s) reference missing %.id values',
        missing_count,
        entity.entity_type,
        entity.table_name;
    END IF;

    EXECUTE format(
      'UPDATE %I t
          SET custom_fields = sub.backfilled || COALESCE(t.custom_fields, ''{}''::jsonb),
              updated_at = now()
         FROM (
           SELECT v.entity_id,
                  jsonb_object_agg(
                    d.key,
                    CASE d.field_type
                      WHEN ''monetary'' THEN jsonb_build_object(
                        ''amountCents'', v.monetary_value_cents,
                        ''currency'', v.currency_code
                      )
                      WHEN ''double'' THEN to_jsonb(v.number_value)
                      WHEN ''boolean'' THEN to_jsonb(v.boolean_value)
                      WHEN ''date'' THEN to_jsonb(v.date_value::text)
                      WHEN ''set'' THEN v.json_value
                      WHEN ''json'' THEN v.json_value
                      WHEN ''address'' THEN v.json_value
                      ELSE to_jsonb(v.text_value)
                    END
                  ) AS backfilled
             FROM custom_field_values v
             JOIN custom_field_definitions d ON d.id = v.definition_id
            WHERE v.entity_type::text = $1
            GROUP BY v.entity_id
         ) sub
        WHERE t.id = sub.entity_id',
      entity.table_name
    ) USING entity.entity_type;
  END LOOP;

  -- Refuse to silently remove unexpected dependent objects. PostgreSQL will
  -- roll the entire migration back if a dependency still needs remediation.
  DROP TABLE custom_field_values;
END $$;
