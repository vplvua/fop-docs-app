## Why

Classification routes payments that the pipeline can't auto-resolve into `awaiting_review` or `in_queue`, but the admin can only resolve them one-by-one from each payment's detail card (`/payments/[id]`). The S7 stopgap (`/payments?status=in_queue`) is just a filtered list — there is no dedicated triage surface, no grouping by reason, and no inline correction. S12 delivers the real `/queue`: a single screen where the admin works the whole backlog with reason-specific inline forms, targeting ≤ 2 minutes per payment.

## What Changes

- New `/queue` route with two tabs: **На апрув** (`Payment.status = awaiting_review`) and **Проблеми класифікації** (`Payment.status = in_queue`). (FR-QUEUE-01)
- Within each tab, payments are grouped by `classification_reason`. (FR-QUEUE-02)
- Reason-specific inline resolution cards, reusing the existing classification server actions (no new pipeline logic):
  - `no_match` → search/link existing client or link to a created client. (FR-QUEUE-03)
  - `multiple_contracts` → radio-select of parsed contract numbers. (FR-QUEUE-04)
  - `multiple_clients_same_edrpou` → warning + selector of active candidate clients (archived hidden). (FR-QUEUE-05)
  - `client_incomplete` → missing-field list with deep-links into the client/contract fields. (FR-QUEUE-06)
  - `amount_mismatch` / `sms_quantity_mismatch` → show the computed variants + correction affordance. (FR-QUEUE-07)
  - `external_edo` → "Вчасно" badge + manual-workflow hint. (FR-QUEUE-08)
- After any inline correction, classification re-runs automatically. (FR-QUEUE-09)
- "Пропустити" sets `Payment.status = skipped` (terminal) from the queue. (FR-QUEUE-10)
- Top-bar navigation gains a "Черга" link (with a pending-count indicator); `/payments?status=in_queue` remains as a raw list but is no longer the primary triage surface.

This is UI/UX polish — no DB migrations, no new pipeline branches. The classification engine, server actions, and matching semantics are unchanged.

## Capabilities

### New Capabilities

- `queue`: The dedicated `/queue` triage surface — two-tab layout, grouping by `classification_reason`, and reason-specific inline resolution cards that drive the existing classification/skip/link server actions and the missing-field computation for `client_incomplete`.

### Modified Capabilities

<!-- None. The classification capability's requirements (pipeline, reasons, server actions, the per-payment "Payment card shows classification actions" requirement) are unchanged; the queue is an additional surface over the same actions. -->

## Impact

- **New code:** `app/(queue)/queue/page.tsx` (RSC: query + group), `app/(queue)/queue/*` client components for each reason card; a `lib/queue/` pure helper for missing-field computation (`client_incomplete`) and reason grouping/ordering.
- **Reused, unchanged:** `classifyPaymentAction`, `skipPaymentAction`, `linkPaymentClientAction` (`app/(dashboard)/payments/[id]/classification-actions.ts`); the `ClientCandidate` shape and reason guidance copy already used by `classification-panel.tsx`.
- **Navigation:** shared top-bar gains a "Черга" entry.
- **No DB changes, no migrations, no new cron, no external API calls.**
- **Tests:** E2E coverage for resolving each reason inside the queue UI; unit tests for the `lib/queue/` helpers.
- **PRD coverage:** FR-QUEUE-01..10.
