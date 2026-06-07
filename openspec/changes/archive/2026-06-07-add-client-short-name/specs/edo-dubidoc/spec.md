## ADDED Requirements

### Requirement: DubiDoc document title identifies client and contract

The DubiDoc `title` field SHALL be composed so the operator can distinguish documents in
the DubiDoc UI without opening them. The title SHALL be:

`{display name} {contract number} Акт {number} від {act_date}`

where:

- **display name** is the client snapshot's short name when present, otherwise the client
  snapshot's full name — i.e. `clientSnapshot.shortName ?? clientSnapshot.name`. The short
  name is the value frozen into the act's client snapshot at act creation; casing is
  preserved exactly.
- **contract number** is `contractSnapshot.number` (bare, no "дог." label).
- **number** and **act_date** are the act's number and date, with `act_date` left as the
  raw ISO date.

The fields are space-separated. The PDF `filename` field SHALL remain unchanged
(`act_<contract>_<YYYY-MM>[_N].pdf`). Because the title is set when the document is sent,
documents already created in DubiDoc keep their original title; only newly sent or re-sent
acts use the new title.

Covers: FR-EDO-01.

#### Scenario: Title uses the client short name

- **WHEN** an act is sent for a client whose snapshot short name is `Молодіжний Новомосковськ`, contract number `556848`, act number `02/2026`, act date `2026-02-28`
- **THEN** the DubiDoc `title` SHALL be `Молодіжний Новомосковськ 556848 Акт 02/2026 від 2026-02-28`

#### Scenario: Title falls back to the full name

- **WHEN** an act is sent for a client whose snapshot short name is empty/NULL, with full name `ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "УПРАВЛЯЮЧА КОМПАНІЯ "ЛАД"`, contract number `557001`, act number `03/2026`, act date `2026-03-31`
- **THEN** the DubiDoc `title` SHALL be `ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "УПРАВЛЯЮЧА КОМПАНІЯ "ЛАД" 557001 Акт 03/2026 від 2026-03-31`

#### Scenario: PDF filename is unchanged

- **WHEN** an act with contract number `556609` and act date `2024-11-30` is sent
- **THEN** the DubiDoc `filename` SHALL remain `act_556609_2024-11.pdf`, independent of the title
