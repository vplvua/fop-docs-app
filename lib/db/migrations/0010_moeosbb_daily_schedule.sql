-- Switch the MoeOSBB sync schedule from the seeded monthly default ("first")
-- to daily, so client requisites propagate the morning after they change in
-- Moe OSBB instead of only on the 1st of the month. Only touches the row if it
-- still holds the seeded default — a deliberate "last"/"manual" choice is kept.
UPDATE "settings"
SET "value" = '"daily"'::jsonb
WHERE "key" = 'moeosbb_sync_schedule' AND "value" = '"first"'::jsonb;
