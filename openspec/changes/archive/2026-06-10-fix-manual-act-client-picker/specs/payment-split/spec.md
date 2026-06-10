## ADDED Requirements

### Requirement: Split line picker presentation

The per-line client picker SHALL use the shared combobox semantics of the manual act form: options labeled by the curated short name, falling back to «Договір №{number}», then to the EDRPOU alone (the full legal name is never displayed but participates in search), and search matching the full name, short name, EDRPOU/РНОКПП, and contract number as case-insensitive substrings. Unlike the manual act picker, the split picker SHALL NOT exclude archived clients (`auto_act_disabled = true`): classification still matches such clients, so a payment from an archived client must remain splittable to it.

#### Scenario: Archived payer client remains selectable in a split

- **WHEN** the admin splits a payment whose payer EDRPOU belongs to an archived (`auto_act_disabled`) contract-bearing client
- **THEN** that client SHALL appear in the split line picker and the split SHALL succeed

#### Scenario: Split picker labels match the manual act picker

- **WHEN** the admin opens a split line's client picker
- **THEN** each option SHALL be labeled by the client's short name (or the contract-number/EDRPOU fallback), never by the full legal name
