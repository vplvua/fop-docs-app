# requisites Specification

## Purpose

Executor (FOP) requisites management — a single validated settings value holding the
ФОП's nominative/genitive names, ІПН, legal address, bank details, tax note, and
contacts. These requisites are editable in the admin Settings area and are snapshotted
onto each act at generation time so that the executor block on a generated act is frozen
at creation.

## Requirements

### Requirement: FOP requisites are stored as a validated settings value

The system SHALL store the executor (FOP) requisites in the `settings` table under the key `fop_requisites` as a single jsonb object. The object SHALL be validated against a Zod schema with the fields: `nameNominative` (string), `nameGenitive` (string), `ipn` (string), `legalAddress` (string), `bankAccount` (string), `bankName` (string), `taxNote` (string), `phone` (string), `email` (string), `city` (string). All fields SHALL be required and non-empty. No dedicated table SHALL be created; the existing `getSettingValue` / `setSettingValue` accessors SHALL be used.

#### Scenario: Valid requisites saved

- **WHEN** an admin submits requisites with every field populated
- **THEN** the value SHALL be persisted under the `fop_requisites` settings key and SHALL validate against the schema

#### Scenario: Incomplete requisites rejected

- **WHEN** an admin submits requisites with any field empty or missing
- **THEN** validation SHALL fail and the value SHALL NOT be persisted, and the admin SHALL see a field-level error

### Requirement: Name strings are stored and rendered verbatim

The system SHALL store `nameNominative` and `nameGenitive` as the exact text to be rendered, with no code-side transformation (no `toUpperCase()`, no concatenated fixed prefixes such as "ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ" or "фізичної особи-підприємця"). Any such prefix SHALL be part of the stored value.

#### Scenario: Nominative rendered as stored

- **WHEN** `nameNominative` is `"ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ПАШКО ВАСИЛЬ ТЕОДОЗІЙОВИЧ"`
- **THEN** the executor requisites header SHALL render that exact string

#### Scenario: Genitive rendered as stored

- **WHEN** `nameGenitive` is `"фізичної особи-підприємця Пашка Василя Теодозійовича"`
- **THEN** the act preamble SHALL embed that exact phrase after "представник Виконавця"

### Requirement: Admin can manage FOP requisites in Settings

The system SHALL provide a `/settings/requisites` page in the admin Settings area, following the existing settings-page pattern, with a "Реквізити" entry in the settings navigation. The page SHALL display the current requisites (or an empty state when unset) and allow editing and saving all fields. The UI SHALL follow DESIGN.md tokens.

#### Scenario: Admin edits and saves requisites

- **WHEN** an admin opens `/settings/requisites`, changes the bank account, and saves
- **THEN** the new value SHALL be persisted and the page SHALL show a success confirmation

#### Scenario: Empty state when unconfigured

- **WHEN** no `fop_requisites` value exists yet
- **THEN** the page SHALL render an empty/initial form rather than error

### Requirement: Requisites are snapshotted onto acts at generation time

The system SHALL copy the current `fop_requisites` value into the act's `fop_snapshot` at act-stub creation. The act PDF SHALL render the executor block from `fop_snapshot`, not from live settings. Subsequent edits to `fop_requisites` SHALL NOT alter the executor block of already-created acts.

#### Scenario: Snapshot frozen at creation

- **WHEN** an act is created while `fop_requisites.bankAccount = "UA-A"`, and the admin later changes it to `"UA-B"`
- **THEN** that act's `fop_snapshot.bankAccount` SHALL remain `"UA-A"` and its PDF SHALL render `"UA-A"`

#### Scenario: Render reads from snapshot

- **WHEN** an act PDF is rendered
- **THEN** the executor name, ІПН, address, account, tax note, phone, and email SHALL be taken from `fop_snapshot`
