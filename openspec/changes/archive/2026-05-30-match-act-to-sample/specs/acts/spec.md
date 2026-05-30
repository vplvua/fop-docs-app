## RENAMED Requirements

- FROM: `### Requirement: PDF generation via headless Chromium`
- TO: `### Requirement: PDF generation matches the sample act layout`

## MODIFIED Requirements

### Requirement: Race-safe act number generation

The system SHALL generate act numbers under `SELECT ... FOR UPDATE` on acts rows for the same `(client_id, act_date)`. The first act for a client in month M of year Y SHALL be numbered `MM/YYYY` (zero-padded month, year derived from `act_date`); subsequent acts SHALL be `MM/YYYY/N` where N is the ordinal position. The UNIQUE index `(client_id, act_date, number)` SHALL serve as a safety net for concurrent inserts.

Covers: FR-ACT-02, FR-ACT-03, TC-INTEG-12.

#### Scenario: First act in month

- **WHEN** no acts exist for client X in April 2026
- **THEN** the act number SHALL be `04/2026`

#### Scenario: Second act in same month

- **WHEN** one act `04/2026` already exists for client X in April 2026
- **THEN** the next act number SHALL be `04/2026/2`

#### Scenario: Concurrent act creation serialized

- **WHEN** two classification attempts create acts for the same client+month simultaneously
- **THEN** the `FOR UPDATE` lock SHALL serialize numbering and both acts SHALL receive distinct numbers

### Requirement: PDF generation matches the sample act layout

The system SHALL render act PDFs locally via a React template converted to PDF using `@react-pdf/renderer` in a Vercel Function (no headless browser). The PDF layout SHALL match the narrative form of `docs/samples/acts/act-2026-04_200.pdf` and `act-2026-04_2000.pdf`, with the following structure:

- a two-line centered heading (regular weight, NOT bold): `АКТ {number}` and `здачі-приймання робіт (надання послуг)`;
- a place/date row: `{city}` (rendered verbatim — the field holds the full place string, e.g. `м. Львів`) left, `act_date` formatted `DD.MM.YYYY` right;
- a justified preamble naming the Замовник (ОСББ name in bold, from `client_snapshot`) and the Виконавець (`fop_snapshot.nameGenitive`), referencing the contract `№{number}` and signed date from `contract_snapshot`;
- a service line `{service_description}, {quantity} шт. – {total} грн.` where quantity renders as an integer;
- a total-in-words line `Загальна вартість робіт (послуг) без ПДВ {total} грн. ({total in words}), ПДВ 0.00 грн.`;
- the line `Сторони претензій одна до одної не мають.`;
- a bordered two-column requisites table with headers `Від Виконавця` / `Від Замовника`.

The executor column SHALL render, from `fop_snapshot`: `nameNominative` (verbatim), `ІПН {ipn}`, `Юридична адреса: {legalAddress}`, `Поточний рахунок: {bankAccount} в {bankName}`, `{taxNote}`, `Тел.: {phone}`, `Електронна адреса: {email}`. The client column SHALL render, from `client_snapshot`: name (bold), `Код ЄДРПОУ: {legalId}`, `Юридична адреса: {address}`, `Поточний рахунок: {bankAccount} в {bankName}`. The template SHALL NOT render signature underlines, a postal address, a second executor bank account, or the client's phone/email, and SHALL NOT render the `ст. 297 ПКУ` note.

Covers: FR-ACT-07, TC-INTEG-05, NFR-PERF-03.

#### Scenario: PDF generated for classified act

- **WHEN** an act with `status = draft` and all snapshot fields (including `fop_snapshot`) populated is passed to the PDF generator
- **THEN** a PDF buffer SHALL be produced containing the two-line heading, place/date row, preamble, service line, total-in-words line, the claims line, and the two-column requisites table

#### Scenario: Amount rendered in words

- **WHEN** the act total is `200.00`
- **THEN** the total line SHALL read `Загальна вартість робіт (послуг) без ПДВ 200.00 грн. (двісті гривень 00 коп.), ПДВ 0.00 грн.`

#### Scenario: Executor block from snapshot, deviations applied

- **WHEN** the act PDF is rendered
- **THEN** the executor column SHALL show exactly one bank account, no postal address, and the client column SHALL omit phone and email

#### Scenario: PDF warm render under 2 seconds

- **WHEN** act PDF generation runs on a warm function instance
- **THEN** PDF generation SHALL complete in under 2 seconds

## ADDED Requirements

### Requirement: Acts carry an immutable FOP snapshot

The system SHALL store a `fop_snapshot` (jsonb) on each act, populated from `fop_requisites` at act-stub creation and used by the PDF renderer as the source of executor details. For acts created before this column existed, the renderer MAY fall back to current requisites until the act is regenerated.

#### Scenario: New act has fop_snapshot

- **WHEN** a new act is created
- **THEN** `fop_snapshot` SHALL contain the requisites values current at creation time

#### Scenario: Renderer prefers snapshot

- **WHEN** an act with a populated `fop_snapshot` is rendered
- **THEN** the executor block SHALL be sourced from `fop_snapshot`, ignoring later changes to `fop_requisites`

### Requirement: Existing acts can be regenerated to the new format

The system SHALL provide a one-off, idempotent operation that re-renders every existing act through the new template, recomputing `service_description` from `service_type` (the current fixed wording), backfilling `fop_snapshot` where absent, and updating `pdf_file_url`. The description SHALL be recomputed for every act, overwriting any prior manual edits. The operation SHALL NOT re-submit documents to EDO; it SHALL only update the locally stored PDF.

#### Scenario: Backfill, recompute description, and re-render

- **WHEN** the mass-regeneration operation runs over an act with `service_type = access` whose stored `service_description` is the legacy `"Доступ до сервісу за період 1 міс."`
- **THEN** the act's `service_description` SHALL become `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)`, it SHALL receive a `fop_snapshot` from current requisites if absent, and a freshly rendered PDF with an updated `pdf_file_url`

#### Scenario: Re-run is safe

- **WHEN** the operation is run a second time
- **THEN** it SHALL complete without error and without re-sending any act to EDO
