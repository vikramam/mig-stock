-- ============================================================
-- Migration 013: receipt number format MIG_INV-001 -> MIG-INV-001
-- Cosmetic prefix change only (underscore -> hyphen after "MIG"). The underlying
-- receipt_seq sequence — the actual incrementing counter — is untouched, so numbering
-- continues exactly where it left off; only the literal prefix text changes, both for
-- new rows (the column default) and existing ones (backfilled below via a straight
-- string replace, safe because every existing value already has a unique numeric
-- suffix that this doesn't touch).
-- Run this directly against the live Supabase project.
-- ============================================================

alter table sales alter column receipt_no set default ('MIG-INV-' || lpad(nextval('receipt_seq')::text, 3, '0'));

update sales set receipt_no = replace(receipt_no, 'MIG_INV-', 'MIG-INV-') where receipt_no like 'MIG_INV-%';
