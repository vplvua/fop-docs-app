## Context

S9 (edo-dubidoc) delivered full API-integrated EDO for DubiDoc clients. The classification pipeline already routes `vchasno_external` clients to `awaiting_review(external_edo)` — but there's no UI to complete the manual Vchasno workflow: mark an act as signed, undo the mark, or regenerate PDF freely.

The act detail panel (`act-detail-panel.tsx`) already has `canEdit` logic that allows editing for `vchasno_external` in any status. The `regeneratePdfAction` and `updateServiceDescriptionAction` already handle `vchasno_external` partially. What's missing: explicit sign/unsign actions and Vchasno-specific status banners.

## Goals / Non-Goals

**Goals:**

- Enable the complete manual Vchasno flow: admin downloads PDF → signs externally in Vchasno → marks as signed in the app.
- Provide `draft ↔ signed` state transitions for `vchasno_external` acts only.
- Allow PDF regeneration and service description editing in any status for `vchasno_external`.
- Show Vchasno-specific status indicators in act detail and act list.

**Non-Goals:**

- No Vchasno API integration (BC-SCOPE-11, TC-INTEG-04).
- No new DB tables, columns, or migrations.
- No changes to classification pipeline (already routes `vchasno_external` correctly).
- No changes to DubiDoc flow.
- No queue UI changes (FR-QUEUE-08 is S12 scope).

## Decisions

### D1: State-machine validation in domain layer

State transitions (`draft → signed`, `signed → draft`) will be validated in a pure function `validateVchasnoTransition(currentStatus, targetStatus, edoProvider)` in `lib/edo/vchasno-state.ts`. Server actions call this before updating DB.

**Why over inline validation in actions:** Keeps actions thin, makes the state machine unit-testable without DB, consistent with how `send-to-dubidoc.ts` validates preconditions.

### D2: Two new server actions, not one toggle

Separate `markActSignedAction(actId)` and `unmarkActSignedAction(actId)` rather than a single `toggleSignedAction`. Each has distinct preconditions and semantics — toggle would be ambiguous under race conditions.

**Why over toggle:** Explicit intent prevents accidental state flips; each action maps 1:1 to a UI button with clear labeling.

### D3: Extend existing `EdoStatusBanners` component

Add Vchasno branches to the existing `EdoStatusBanners` component rather than creating a separate `VchasnoStatusBanners`. The component already switches on `edoProvider` — adding `vchasno_external` cases keeps the rendering logic co-located.

**Why over separate component:** The banner area is a single visual slot on the act detail page. Splitting it across components would require coordination for positioning. The existing component is small (~50 lines).

### D4: PDF regeneration — no status restriction for vchasno_external

`regeneratePdfAction` currently works for any status since it doesn't check status. But for `vchasno_external`, we explicitly skip the DubiDoc auto-send after regeneration (already handled — the action checks `edoProvider === "dubidoc"`). No code change needed for the action itself.

For the UI, the `RegenerateButton` is already shown unconditionally. No change needed.

### D5: Act list badge

Add a "Вчасно" text badge in the existing `edoProvider` column of the acts table. This mirrors the existing "Дубідок" label approach — no new column, just the provider display mapping that already exists at `app/(dashboard)/acts/page.tsx:19`.

## Risks / Trade-offs

- **[Low] Race condition on mark/unmark**: Two browser tabs could mark and unmark simultaneously. Mitigation: each action re-reads current status from DB before updating — last-write-wins is acceptable for single-admin system.
- **[Low] Signed act with stale PDF**: Admin signs in Vchasno, marks as signed, then regenerates PDF — the externally-signed PDF in Vchasno won't match. Mitigation: this is by-design per FR-ACT-09; admin is aware they're regenerating after signing.
