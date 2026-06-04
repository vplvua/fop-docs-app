## 1. Spike — перевірити вбудовування Дубідок в iframe (R1, блокує UI)

> ✅ Перевірено користувачем у dev (2026-06-04): iframe Дубідок відрендерився
> всередині `docs.moeosbb.com` (embedding НЕ заблоковано), підпис ЕЦП КЕП
> (файловий ключ) пройшов, домен покривається CSP `*.dubidoc.com.ua`.

- [x] 1.1 Згенерувати sign-посилання вручну для тестового акта (`POST /api/v1/documents/{id}/links { action: "sign" }`) і перевірити заголовки відповіді сторінки підпису Дубідок (`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`) — embedding не блокується
- [x] 1.2 Локально відкрити отриманий URL в `<iframe>` і переконатися, що сторінка підпису рендериться (не блокується), методи підпису доступні
- [x] 1.3 Зафіксувати точний домен сторінки підпису для CSP `frame-src` — `*.dubidoc.com.ua` підтверджено робочим

## 2. API-клієнт Дубідок

- [x] 2.1 `lib/external-apis/dubidoc/types.ts` — додати `GenerateLinkResponse { link: string }`
- [x] 2.2 `lib/external-apis/dubidoc/client.ts` — додати `generateSigningLink(docId)` (`POST /documents/{docId}/links` з body `{ action: "sign" }`, через наявний `attemptRequest`)
- [x] 2.3 `lib/external-apis/dubidoc/client.ts` — додати `deleteSigningLinks(docId)` (`DELETE /documents/{docId}/links`)
- [x] 2.4 `lib/external-apis/dubidoc/index.ts` — реекспортувати нові функції і тип
- [x] 2.5 Юніт-тести (`tests/unit/edo/`) + MSW-handler-и (`tests/mocks/handlers/dubidoc.ts`) для links POST/DELETE (success, 401, 429, 5xx-retry)

## 3. Server actions

- [x] 3.1 `app/(dashboard)/acts/[id]/act-actions.ts` — `getSigningLinkAction(actId)`: завантажити акт, провалідувати `edo_provider = dubidoc` + `status = sent_to_edo` + наявність `edo_doc_id`, викликати `generateSigningLink`, повернути `{ url }` (без токена в клієнті)
- [x] 3.2 `app/(dashboard)/acts/[id]/act-actions.ts` — `revokeSigningLinkAction(actId)`: завантажити акт, викликати `deleteSigningLinks(edo_doc_id)` (ідемпотентно, помилку DELETE логувати, не валити флоу)
- [x] 3.3 Юніт-тести для guard-умов обох actions (відхилення для невідповідного статусу/провайдера/без edo_doc_id)

## 4. UI — модалка з iframe

- [x] 4.1 `app/(dashboard)/acts/[id]/dubidoc-signing-widget.tsx` (новий) — клієнтський компонент-модалка: приймає `actId`, при відкритті викликає `getSigningLinkAction`, показує `loading`, рендерить `<iframe src={url}>` (повна висота, як у zbory `h-[70vh] w-full`)
- [x] 4.2 У компоненті — кнопка «Готово/Закрити»: викликає `revokeSigningLinkAction` + `refreshDubidocStatusAction` + `router.refresh()`, потім закриває модалку
- [x] 4.3 Стани помилки: якщо `getSigningLinkAction` впав — показати повідомлення і кнопку «Перейти в Дубідок» як fallback
- [x] 4.4 Кнопка-тригер «Підписати тут» у `app/(dashboard)/acts/[id]/edo-controls.tsx` (з `loading`-станом, патерн наявних кнопок)
- [x] 4.5 `app/(dashboard)/acts/[id]/act-detail-panel.tsx` — підключити «Підписати тут» поряд із «Перейти в Дубідок», умова показу: `edo_provider = dubidoc` + `status = sent_to_edo`

## 5. CSP

- [x] 5.1 Додати `frame-src` із доменом Дубідок у Content-Security-Policy застосунку (`next.config.ts` `async headers()`, тільки `frame-src` без `default-src` — інші ресурси не обмежено). Закладено `*.dubidoc.com.ua` + `dubidoc.com.ua`; точний домен підтвердити в spike 1.3 і за потреби звузити.

## 6. Якість і перевірка

- [x] 6.1 `npm run qa` (lint → format → typecheck → test → build → openspec validate) — зелено
- [x] 6.2 Prod e2e (2026-06-04, screenshots): новий акт 05/2026 `sent_to_edo` → «Підписати тут» → підпис ЕЦП в iframe → «Готово» → акт коректно став `waiting_for_client_sign` («Ви підписали — очікує підпису клієнта»), документ надіслано клієнту через `/send`. Початковий баг (одразу `Підписано` через org-relative `status`) виправлено: мапінг тепер по документ-level `state` + явний `/send` після підпису.
- [x] 6.3 Сценарій «закрив без підпису» покрито дизайном (revoke + повторна генерація посилання) і юніт-тестами (`finalize` не кличе `/send` коли `state=new, status=new`; статус лишається `sent_to_edo`).
