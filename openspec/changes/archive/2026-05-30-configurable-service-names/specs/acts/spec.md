## MODIFIED Requirements

### Requirement: Existing acts can be regenerated to the new format

The system SHALL provide a one-off, idempotent operation that re-renders every existing act through the new template, recomputing `service_description` from `service_type` using the configured service name (from the `service_names` setting, falling back to the default wording when unset), reformatting `number` to the `MM/YYYY[/N]` format while preserving its per-client/month ordinal, backfilling `fop_snapshot` where absent, and updating `pdf_file_url`. The description SHALL be recomputed for every act, overwriting any prior manual edits. The operation SHALL NOT re-submit documents to EDO; it SHALL only update the locally stored PDF.

#### Scenario: Reformat number, recompute description, backfill, and re-render

- **WHEN** the mass-regeneration operation runs over an act with `act_date = "2026-05-31"`, `number = "№5"`, `service_type = access`, the legacy `service_description = "Доступ до сервісу за період 1 міс."`, and `service_names.access = "Надання доступу до сервісу \"Моє ОСББ\" (один календарний місяць)"`
- **THEN** the act's `number` SHALL become `05/2026`, its `service_description` SHALL become the configured access name, it SHALL receive a `fop_snapshot` from current requisites if absent, and a freshly rendered PDF with an updated `pdf_file_url`

#### Scenario: Legacy ordinal preserved

- **WHEN** the operation runs over an act with `act_date = "2026-05-31"` and `number = "№5/2"`
- **THEN** the act's `number` SHALL become `05/2026/2`

#### Scenario: Re-run is safe

- **WHEN** the operation is run a second time
- **THEN** it SHALL complete without error and without re-sending any act to EDO
