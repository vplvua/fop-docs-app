INSERT INTO "tariffs" ("apartments_min", "apartments_max", "price", "effective_from")
VALUES (0, NULL, '200.00', '2024-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO "sms_prices" ("price", "effective_from")
VALUES ('1.40', '2024-01-01')
ON CONFLICT DO NOTHING;
