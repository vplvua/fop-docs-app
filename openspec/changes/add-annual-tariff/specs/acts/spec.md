## MODIFIED Requirements

### Requirement: PDF generation matches the sample act layout

The system SHALL render act PDFs locally via a React template converted to PDF using `@react-pdf/renderer` in a Vercel Function (no headless browser). In the service and total lines, `{total}` SHALL be the act's stored `amount` (the actual payment total), NOT `unit_price × quantity` — so a discounted annual act shows its exact paid total. The PDF layout SHALL match the narrative form of `docs/samples/acts/act-2026-04_200.pdf` and `act-2026-04_2000.pdf`, with the following structure:

- a two-line centered heading (regular weight, NOT bold): `АКТ {number}` and `здачі-приймання робіт (надання послуг)`;
- a place/date row: `{city}` (rendered verbatim — the field holds the full place string, e.g. `м. Львів`) left, `act_date` formatted `DD.MM.YYYY` right;
- a justified preamble naming the Замовник (ОСББ name in bold, from `client_snapshot`) and the Виконавець (`fop_snapshot.nameGenitive`), referencing the contract `№{number}` and signed date from `contract_snapshot`;
- a service line `{service_description}, {quantity} шт. – {total} грн.` where quantity renders as an integer and `{total}` is the stored `amount`;
- a total-in-words line `Загальна вартість робіт (послуг) без ПДВ {total} грн. ({total in words}), ПДВ 0.00 грн.`;
- the line `Сторони претензій одна до одної не мають.`;
- a bordered two-column requisites table with headers `Від Виконавця` / `Від Замовника`.

The executor column SHALL render, from `fop_snapshot`: `nameNominative` (verbatim), `ІПН {ipn}`, `Юридична адреса: {legalAddress}`, `Поточний рахунок: {bankAccount} в {bankName}`, `{taxNote}`, `Тел.: {phone}`, `Електронна адреса: {email}`. The client column SHALL render, from `client_snapshot`: name (bold), `Код ЄДРПОУ: {legalId}`, `Юридична адреса: {address}`, `Поточний рахунок: {bankAccount} в {bankName}`. The template SHALL NOT render signature underlines, a postal address, a second executor bank account, or the client's phone/email, and SHALL NOT render the `ст. 297 ПКУ` note.

Covers: FR-ACT-07, TC-INTEG-05, NFR-PERF-03.

#### Scenario: PDF generated for classified act

- **WHEN** an act with `status = draft` and all snapshot fields (including `fop_snapshot` and `amount`) populated is passed to the PDF generator
- **THEN** a PDF buffer SHALL be produced containing the two-line heading, place/date row, preamble, service line, total-in-words line, the claims line, and the two-column requisites table

#### Scenario: Annual act renders the paid total at quantity 12

- **WHEN** an act with `quantity = 12`, `unit_price = 200.00`, `amount = 2000.00`, `billing_period = annual` is rendered
- **THEN** the service line SHALL read `{service_description}, 12 шт. – 2000.00 грн.` and the total line SHALL read `Загальна вартість робіт (послуг) без ПДВ 2000.00 грн. (дві тисячі гривень 00 коп.), ПДВ 0.00 грн.`

#### Scenario: Monthly act unchanged

- **WHEN** an act with `unit_price = 200.00`, `quantity = 1`, `amount = 200.00` is rendered
- **THEN** the total SHALL be `200.00` (identical to `unit_price × quantity`)

#### Scenario: Amount rendered in words

- **WHEN** the act total is `200.00`
- **THEN** the total line SHALL read `Загальна вартість робіт (послуг) без ПДВ 200.00 грн. (двісті гривень 00 коп.), ПДВ 0.00 грн.`
