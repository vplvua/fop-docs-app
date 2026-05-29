## 1. DB / enum

- [x] 1.1 ~~Додати enum value~~ — `classification_reason` зберігається як `text`, не Postgres ENUM; нове значення додано лише в TS-константу (`lib/classification/types.ts`)
- [x] 1.2 ~~Drizzle-міграція~~ — **не потрібна** (reason = text, не ENUM)
- [x] 1.3 ~~Note в operations.md про prod-міграцію~~ — **не потрібно** (немає міграції БД)

## 2. Типи та результат матчингу

- [x] 2.1 Додати `multiple_clients_same_edrpou` до `CLASSIFICATION_REASONS` (`lib/classification/types.ts`)
- [x] 2.2 Розширити `MatchResult` варіантом `awaiting_review` з `candidateClientIds: string[]`; додано `forcedClient` у `ClassificationInput`

## 3. Логіка матчингу (EDRPOU-first)

- [x] 3.1 Переписати `matchClient`: не-транзит → candidates за `legal_id`, `activeCandidates`, резолв за D1
- [x] 3.2 Транзит-гілка: матч по договору серед `activeCandidates` + multiple_clients_same_edrpou
- [x] 3.3 У `classify.ts` перенести `multiple_contracts` у matchClient (блокує лише як розрізнювач); forcedClient skip-matching
- [x] 3.4 Узгоджено крок `auto_act_disabled` (активний сусід пріоритет; одиничний архівний → awaiting_review)

## 4. Ручна привʼязка в межах ЄДРПОУ

- [x] 4.1 `linkPaymentClientAction` з валідацією через `lib/classification/link-validation.ts` (same EDRPOU / транзит за договором)
- [x] 4.2 `runClassification(paymentId, forcedClientId)` — продовжує pipeline для обраного клієнта
- [x] 4.3 Кандидати кодуються в reason `multiple_clients_same_edrpou:<ids>` і вантажаться на сторінці платежу

## 5. UI платежу

- [x] 5.1 Guidance для `multiple_clients_same_edrpou` + попередження в панелі
- [x] 5.2 Селектор активних кандидатів (договір, moeosbb-ID) + виклик дії привʼязки; архівовані приховані (вантажаться лише id з reason)
- [x] 5.3 DESIGN-токени та стани loading/error як у наявній панелі (винесено `ActionButtons`/`ClientSelector`/`CandidateRow`)

## 6. Тести

- [x] 6.1 Unit `match-client` (10 кейсів: хибний договір ігнорується, no_match, розрізнення по договору, multiple_clients_same_edrpou, активний-vs-архівний, одиничний/кілька архівних, транзит)
- [x] 6.2 Unit `link-validation` (приймає той самий ЄДРПОУ, відхиляє інший, транзит за договором)
- [ ] 6.3 Integration smoke: класифікація з кількома активними/архівними на один ЄДРПОУ — **відкладено**: integration-харнес (Neon test-branch, D-038) ще не налаштований у репо
- [x] 6.4 Транзит: матч по договору серед активних (unit); multiple_contracts блокує лише як розрізнювач (unit)

## 7. Документація та ADR

- [x] 7.1 ADR `D-041-edrpou-first-matching.md` (переглядає D-009; уточнює D-008/D-014/D-027/D-003)
- [x] 7.2 Оновлено `docs/prd.md` (FR-CLASS-02/04/05/06/07, FR-QUEUE-05)
- [ ] 7.3 Real behavior proof: рекласифікувати платіж РЕСПЕКТ → акт на 557352 — **для PR** (потребує запущеного застосунку/БД)

## 8. Релізні кроки

- [x] 8.1 `npm run qa` — 6/6 зелені (lint, format, typecheck, test 65 passed, build, openspec validate)
- [ ] 8.2 Після деплою: повторна класифікація наявних `in_queue`/`awaiting_review` (РЕСПЕКТ) — **post-deploy**
