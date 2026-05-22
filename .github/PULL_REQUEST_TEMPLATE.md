<!--
Заповни секції нижче перед тим, як просити review.
CI ai-pr-check.yml перевіряє наявність непорожньої секції "## Real behavior proof"
з посиланням на screenshot / recording / лог — без цього merge буде заблокований.
-->

## Summary

<!-- 1-3 речення: що змінено і чому. Лінкуй FR-ID з docs/prd.md, якщо застосовно. -->

-

## Linked artifacts

- OpenSpec change: `openspec/changes/<name>/`
- Capability slice: `S?` (див. docs/mvp-capability-plan.md § 5)
- FR / NFR / TC: `FR-…`
- ADR (якщо створено): `D-…`

## Real behavior proof

<!--
ОБОВ'ЯЗКОВО. Покажи, що зміна реально працює — не лише компілюється.
Мінімум: один з {screen recording, screenshot, verification log}.
Без цього CI fails.
-->

### Demo recording / screenshot

<!-- ![cancel-order](https://github.com/<user>/<repo>/assets/.../cancel-flow.mp4) -->

### Reproduction steps

1.
2.
3.

### Verification log excerpt

```
DELETE /api/orders/abc123: 200 OK (143ms)
Order status: pending → cancelled
Audit log entry created (id: log_xyz789)
```

## QA checklist

- [ ] `npm run qa` локально → all gates green
- [ ] Unit tests додано / оновлено для зміненої логіки
- [ ] Якщо capability slice — `docs/qa/traceability-matrix.md` оновлено (FR-ID → spec → test → recording)
- [ ] Якщо capability slice — `docs/current-state.md` оновлено (Recent activity, Capability matrix)
- [ ] DESIGN.md токени використані для будь-якої нової UI-поверхні
- [ ] Імпортні межі дотримано: `app/` не імпортує `app/api/internals/`, `lib/` без Next.js залежностей

## Risks / rollback

<!-- Що може зламатись? Як відкотити? (Vercel "Promote to Production" попередньої версії — D-035.) -->
