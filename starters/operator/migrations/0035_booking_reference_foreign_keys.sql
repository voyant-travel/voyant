CREATE OR REPLACE FUNCTION _voyant_table_exists(table_name text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN to_regclass(table_name) IS NOT NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION _voyant_null_dangling_ref(
  source_table text,
  source_column text,
  target_table text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NOT _voyant_table_exists(source_table)
    OR NOT _voyant_table_exists(target_table)
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = source_table
        AND column_name = source_column
    )
  THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE %I AS source SET %I = NULL WHERE source.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I AS target WHERE target.id = source.%I)',
    source_table,
    source_column,
    source_column,
    target_table,
    source_column
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION _voyant_add_fk(
  source_table text,
  constraint_name text,
  source_column text,
  target_table text,
  on_delete_action text,
  validate_existing boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  source_table_oid oid := to_regclass(source_table);
  normalized_constraint_name name := constraint_name::name;
BEGIN
  IF
    source_table_oid IS NULL
    OR NOT _voyant_table_exists(target_table)
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = source_table
        AND column_name = source_column
    )
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = source_table_oid
      AND conname = normalized_constraint_name
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s ON UPDATE no action NOT VALID',
      source_table,
      normalized_constraint_name,
      source_column,
      target_table,
      on_delete_action
    );
  END IF;

  IF validate_existing THEN
    EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', source_table, normalized_constraint_name);
  END IF;
END;
$$;--> statement-breakpoint

SELECT _voyant_null_dangling_ref('bookings', 'person_id', 'people');
SELECT _voyant_null_dangling_ref('bookings', 'organization_id', 'organizations');
SELECT _voyant_null_dangling_ref('bookings', 'fx_rate_set_id', 'fx_rate_sets');
SELECT _voyant_null_dangling_ref('booking_travelers', 'person_id', 'people');
SELECT _voyant_null_dangling_ref('booking_staff_assignments', 'person_id', 'people');
SELECT _voyant_null_dangling_ref('booking_groups', 'primary_booking_id', 'bookings');
SELECT _voyant_null_dangling_ref('vouchers', 'issued_to_person_id', 'people');
SELECT _voyant_null_dangling_ref('vouchers', 'issued_to_organization_id', 'organizations');
SELECT _voyant_null_dangling_ref('vouchers', 'source_booking_id', 'bookings');
SELECT _voyant_null_dangling_ref('vouchers', 'source_payment_id', 'payments');
SELECT _voyant_null_dangling_ref('voucher_redemptions', 'payment_id', 'payments');
SELECT _voyant_null_dangling_ref('payment_instruments', 'person_id', 'people');
SELECT _voyant_null_dangling_ref('payment_instruments', 'organization_id', 'organizations');
SELECT _voyant_null_dangling_ref('payment_instruments', 'supplier_id', 'suppliers');
SELECT _voyant_null_dangling_ref('payment_instruments', 'channel_id', 'channels');
SELECT _voyant_null_dangling_ref('payment_sessions', 'booking_id', 'bookings');
SELECT _voyant_null_dangling_ref('payment_sessions', 'order_id', 'orders');
SELECT _voyant_null_dangling_ref('payment_sessions', 'payer_person_id', 'people');
SELECT _voyant_null_dangling_ref('payment_sessions', 'payer_organization_id', 'organizations');
SELECT _voyant_null_dangling_ref('payment_authorizations', 'booking_id', 'bookings');
SELECT _voyant_null_dangling_ref('payment_authorizations', 'order_id', 'orders');
SELECT _voyant_null_dangling_ref('payment_authorizations', 'booking_guarantee_id', 'booking_guarantees');
SELECT _voyant_null_dangling_ref('booking_payment_schedules', 'booking_item_id', 'booking_items');
SELECT _voyant_null_dangling_ref('booking_guarantees', 'booking_item_id', 'booking_items');
SELECT _voyant_null_dangling_ref('booking_item_commissions', 'channel_id', 'channels');
SELECT _voyant_null_dangling_ref('invoices', 'converted_from_invoice_id', 'invoices');
SELECT _voyant_null_dangling_ref('invoices', 'series_id', 'invoice_number_series');
SELECT _voyant_null_dangling_ref('invoices', 'template_id', 'invoice_templates');
SELECT _voyant_null_dangling_ref('invoices', 'tax_regime_id', 'tax_regimes');
SELECT _voyant_null_dangling_ref('invoices', 'person_id', 'people');
SELECT _voyant_null_dangling_ref('invoices', 'organization_id', 'organizations');
SELECT _voyant_null_dangling_ref('invoices', 'fx_rate_set_id', 'fx_rate_sets');
SELECT _voyant_null_dangling_ref('invoice_line_items', 'booking_item_id', 'booking_items');
SELECT _voyant_null_dangling_ref('payments', 'fx_rate_set_id', 'fx_rate_sets');
SELECT _voyant_null_dangling_ref('credit_notes', 'fx_rate_set_id', 'fx_rate_sets');
SELECT _voyant_null_dangling_ref('supplier_payments', 'supplier_id', 'suppliers');
SELECT _voyant_null_dangling_ref('supplier_payments', 'booking_supplier_status_id', 'booking_supplier_statuses');
SELECT _voyant_null_dangling_ref('supplier_payments', 'fx_rate_set_id', 'fx_rate_sets');
SELECT _voyant_null_dangling_ref('tax_classes', 'default_regime_id', 'tax_regimes');--> statement-breakpoint

SELECT _voyant_add_fk('bookings', 'bookings_person_id_people_id_fk', 'person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('bookings', 'bookings_organization_id_organizations_id_fk', 'organization_id', 'organizations', 'set null', true);
SELECT _voyant_add_fk('bookings', 'bookings_fx_rate_set_id_fx_rate_sets_id_fk', 'fx_rate_set_id', 'fx_rate_sets', 'set null', true);
SELECT _voyant_add_fk('booking_travelers', 'booking_travelers_person_id_people_id_fk', 'person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('booking_staff_assignments', 'booking_staff_assignments_person_id_people_id_fk', 'person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('booking_groups', 'booking_groups_primary_booking_id_bookings_id_fk', 'primary_booking_id', 'bookings', 'set null', true);
SELECT _voyant_add_fk('vouchers', 'vouchers_issued_to_person_id_people_id_fk', 'issued_to_person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('vouchers', 'vouchers_issued_to_organization_id_organizations_id_fk', 'issued_to_organization_id', 'organizations', 'set null', true);
SELECT _voyant_add_fk('vouchers', 'vouchers_source_booking_id_bookings_id_fk', 'source_booking_id', 'bookings', 'set null', true);
SELECT _voyant_add_fk('vouchers', 'vouchers_source_payment_id_payments_id_fk', 'source_payment_id', 'payments', 'set null', true);
SELECT _voyant_add_fk('voucher_redemptions', 'voucher_redemptions_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'restrict', false);
SELECT _voyant_add_fk('voucher_redemptions', 'voucher_redemptions_payment_id_payments_id_fk', 'payment_id', 'payments', 'set null', true);
SELECT _voyant_add_fk('payment_instruments', 'payment_instruments_person_id_people_id_fk', 'person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('payment_instruments', 'payment_instruments_organization_id_organizations_id_fk', 'organization_id', 'organizations', 'set null', true);
SELECT _voyant_add_fk('payment_instruments', 'payment_instruments_supplier_id_suppliers_id_fk', 'supplier_id', 'suppliers', 'set null', true);
SELECT _voyant_add_fk('payment_instruments', 'payment_instruments_channel_id_channels_id_fk', 'channel_id', 'channels', 'set null', true);
SELECT _voyant_add_fk('payment_sessions', 'payment_sessions_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'set null', true);
SELECT _voyant_add_fk('payment_sessions', 'payment_sessions_order_id_orders_id_fk', 'order_id', 'orders', 'set null', true);
SELECT _voyant_add_fk('payment_sessions', 'payment_sessions_payer_person_id_people_id_fk', 'payer_person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('payment_sessions', 'payment_sessions_payer_organization_id_organizations_id_fk', 'payer_organization_id', 'organizations', 'set null', true);
SELECT _voyant_add_fk('payment_authorizations', 'payment_authorizations_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'set null', true);
SELECT _voyant_add_fk('payment_authorizations', 'payment_authorizations_order_id_orders_id_fk', 'order_id', 'orders', 'set null', true);
SELECT _voyant_add_fk('payment_authorizations', 'payment_authorizations_booking_guarantee_id_booking_guarantees_id_fk', 'booking_guarantee_id', 'booking_guarantees', 'set null', true);
SELECT _voyant_add_fk('booking_payment_schedules', 'booking_payment_schedules_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'cascade', false);
SELECT _voyant_add_fk('booking_payment_schedules', 'booking_payment_schedules_booking_item_id_booking_items_id_fk', 'booking_item_id', 'booking_items', 'set null', true);
SELECT _voyant_add_fk('booking_guarantees', 'booking_guarantees_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'cascade', false);
SELECT _voyant_add_fk('booking_guarantees', 'booking_guarantees_booking_item_id_booking_items_id_fk', 'booking_item_id', 'booking_items', 'set null', true);
SELECT _voyant_add_fk('booking_item_tax_lines', 'booking_item_tax_lines_booking_item_id_booking_items_id_fk', 'booking_item_id', 'booking_items', 'cascade', false);
SELECT _voyant_add_fk('booking_item_commissions', 'booking_item_commissions_booking_item_id_booking_items_id_fk', 'booking_item_id', 'booking_items', 'cascade', false);
SELECT _voyant_add_fk('booking_item_commissions', 'booking_item_commissions_channel_id_channels_id_fk', 'channel_id', 'channels', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_converted_from_invoice_id_invoices_id_fk', 'converted_from_invoice_id', 'invoices', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_series_id_invoice_number_series_id_fk', 'series_id', 'invoice_number_series', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_template_id_invoice_templates_id_fk', 'template_id', 'invoice_templates', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_tax_regime_id_tax_regimes_id_fk', 'tax_regime_id', 'tax_regimes', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'restrict', false);
SELECT _voyant_add_fk('invoices', 'invoices_person_id_people_id_fk', 'person_id', 'people', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_organization_id_organizations_id_fk', 'organization_id', 'organizations', 'set null', true);
SELECT _voyant_add_fk('invoices', 'invoices_fx_rate_set_id_fx_rate_sets_id_fk', 'fx_rate_set_id', 'fx_rate_sets', 'set null', true);
SELECT _voyant_add_fk('invoice_line_items', 'invoice_line_items_booking_item_id_booking_items_id_fk', 'booking_item_id', 'booking_items', 'set null', true);
SELECT _voyant_add_fk('payments', 'payments_fx_rate_set_id_fx_rate_sets_id_fk', 'fx_rate_set_id', 'fx_rate_sets', 'set null', true);
SELECT _voyant_add_fk('credit_notes', 'credit_notes_fx_rate_set_id_fx_rate_sets_id_fk', 'fx_rate_set_id', 'fx_rate_sets', 'set null', true);
SELECT _voyant_add_fk('supplier_payments', 'supplier_payments_booking_id_bookings_id_fk', 'booking_id', 'bookings', 'restrict', false);
SELECT _voyant_add_fk('supplier_payments', 'supplier_payments_supplier_id_suppliers_id_fk', 'supplier_id', 'suppliers', 'set null', true);
SELECT _voyant_add_fk('supplier_payments', 'supplier_payments_booking_supplier_status_id_booking_supplier_statuses_id_fk', 'booking_supplier_status_id', 'booking_supplier_statuses', 'set null', true);
SELECT _voyant_add_fk('supplier_payments', 'supplier_payments_fx_rate_set_id_fx_rate_sets_id_fk', 'fx_rate_set_id', 'fx_rate_sets', 'set null', true);
SELECT _voyant_add_fk('tax_classes', 'tax_classes_default_regime_id_tax_regimes_id_fk', 'default_regime_id', 'tax_regimes', 'set null', true);
SELECT _voyant_add_fk('tax_policy_rules', 'tax_policy_rules_profile_id_tax_policy_profiles_id_fk', 'profile_id', 'tax_policy_profiles', 'cascade', false);
SELECT _voyant_add_fk('tax_policy_rules', 'tax_policy_rules_tax_regime_id_tax_regimes_id_fk', 'tax_regime_id', 'tax_regimes', 'restrict', false);--> statement-breakpoint

DROP FUNCTION _voyant_add_fk(text, text, text, text, text, boolean);
DROP FUNCTION _voyant_null_dangling_ref(text, text, text);
DROP FUNCTION _voyant_table_exists(text);
