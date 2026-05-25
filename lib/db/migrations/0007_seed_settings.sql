INSERT INTO "settings" ("key", "value") VALUES
  ('contract_regex_patterns', '[{"pattern":"договір\\\\s*[№#N]?\\\\s*(\\\\d{5,6})","description":"договір №556770"},{"pattern":"дог[оi]в[оi][рp]\\\\s*[№#N]?\\\\s*(\\\\d{5,6})","description":"опечатки договiр"},{"pattern":"dogovir\\\\s*[№#N]?\\\\s*(\\\\d{5,6})","description":"латиниця dogovir"},{"pattern":"(\\\\d{6})\\\\s+ЗГІДНО\\\\s+ДОГОВОРУ","description":"556434 ЗГІДНО ДОГОВОРУ"},{"pattern":"[№#N]\\\\s*(\\\\d{5,6})(?!\\\\d)","description":"просто №556770"}]'::jsonb),
  ('sms_keywords', '["смс","sms","повідомлення"]'::jsonb),
  ('transit_edrpou_list', '["14360570"]'::jsonb),
  ('privatbank_polling_interval_minutes', '60'::jsonb),
  ('dubidoc_poll_interval_hours', '6'::jsonb),
  ('moeosbb_sync_schedule', '"first"'::jsonb)
ON CONFLICT ("key") DO NOTHING;
