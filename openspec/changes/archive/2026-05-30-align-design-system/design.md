## Context

The app uses Tailwind CSS 4 with shadcn/ui. Theme tokens live as CSS custom
properties in `app/globals.css`: a `@theme inline` block maps Tailwind color
utilities (`--color-primary`, `--color-background`, …) to runtime variables
(`--primary`, `--background`, …) defined in `:root` (light) and `.dark`. All
components reference the **semantic** utilities (`bg-primary`, `text-foreground`,
`border-border`, `bg-card`, `text-muted-foreground`) — there are no hex literals
or ad-hoc shades in component code, and no shadcn primitive files under
`app/ui/` (elements are hand-written Tailwind on the semantic vars).

This means the design system is a **single chokepoint**: rewrite the `:root`
values + the font in `layout.tsx`, and every surface updates at once. The
markup of the 16 pages does not need structural change.

`DESIGN.md` describes the full Notion brand (marketing + product). This change
adopts only the **product/admin subset**.

## Goals / Non-Goals

**Goals:**

- Remap `:root` CSS vars to `DESIGN.md colors.*` — purple primary, warm-neutral
  surfaces, ink/charcoal/slate/steel text ramp.
- Add semantic tokens `--success` / `--warning` (shadcn default ships only
  `--destructive`) and expose via `@theme inline`.
- Swap Geist → Inter with `cyrillic` subset (fixes serif-fallback bug).
- Align radius so buttons/inputs = 8px, cards = 12px.
- Apply semantic colors to payment/act status badges + dashboard health banners.
- Adopt the `typography.*` scale for page-level headings.
- Keep `.dark` internally consistent (DESIGN.md only surfaces dark-mode tokens
  for hero bands — see Non-Goals).

**Non-Goals:**

- Marketing surfaces: navy hero band, pastel feature cards (`card-feature-*`),
  pricing comparison tables, testimonial/logo-wall/FAQ/stat-row, multi-column
  footer, workspace-mockup cards. The app has none of these pages.
- A full dark-mode palette. DESIGN.md "Known Gaps" notes dark tokens aren't
  surfaced beyond hero bands. Keep the existing `.dark` block functional but do
  not invest in brand-accurate dark theming this slice.
- Restructuring page layouts, adding components, or changing any domain behavior.
- Building a Notion-Sans web-font pipeline (font is proprietary; Inter is the
  documented fallback).

## Decisions

### D-DS-01: Token remap in `globals.css` is the whole color change

**Choice:** Bring the app into compliance by rewriting `:root` CSS variables, not
by editing component className strings.

**Why:** Components already consume semantic vars. Changing `--primary` from
near-black to purple recolors every CTA, active tab, queue badge, and focus ring
in one edit. This keeps the diff small and auditable and honors the AGENTS.md
"token mapping" boundary.

**Alternative rejected:** Per-component Tailwind color classes — would scatter
the palette across 16 pages and reintroduce the drift this change fixes.

### D-DS-02: Color token → CSS variable mapping

DESIGN.md hex values are the **source of truth**. CSS-var definitions are the
sanctioned token-mapping layer, so hex literals are allowed _there_ (and nowhere
else). Implementation may keep hex directly (Tailwind 4 / CSS accept it) or
convert to `oklch` to match the file's current style — recommend keeping the
DESIGN.md hex to prevent conversion drift.

Light mode (`:root`):

| shadcn var               | DESIGN.md token          | Value     | Role                                     |
| ------------------------ | ------------------------ | --------- | ---------------------------------------- |
| `--background`           | `colors.canvas`          | `#ffffff` | Page background                          |
| `--foreground`           | `colors.ink`             | `#1a1a1a` | Primary text                             |
| `--card`                 | `colors.canvas`          | `#ffffff` | Card / top-bar surface                   |
| `--card-foreground`      | `colors.ink`             | `#1a1a1a` | Text on cards                            |
| `--popover`              | `colors.canvas`          | `#ffffff` | Dropdowns / popovers                     |
| `--popover-foreground`   | `colors.ink`             | `#1a1a1a` |                                          |
| `--primary`              | `colors.primary`         | `#5645d4` | **Purple** CTA, active tab, accents      |
| `--primary-foreground`   | `colors.on-primary`      | `#ffffff` | Text on purple                           |
| `--secondary`            | `colors.surface`         | `#f6f5f4` | Quiet fills, secondary buttons           |
| `--secondary-foreground` | `colors.charcoal`        | `#37352f` |                                          |
| `--muted`                | `colors.surface`         | `#f6f5f4` | Muted backgrounds, table header strip    |
| `--muted-foreground`     | `colors.steel`           | `#787671` | Secondary/placeholder text               |
| `--accent`               | `colors.surface`         | `#f6f5f4` | Hover backgrounds                        |
| `--accent-foreground`    | `colors.ink`             | `#1a1a1a` |                                          |
| `--destructive`          | `colors.semantic-error`  | `#e03131` | Destructive actions ("Видалити")         |
| `--border`               | `colors.hairline`        | `#e5e3df` | Dividers, card borders                   |
| `--input`                | `colors.hairline-strong` | `#c8c4be` | Input borders (stronger per DESIGN)      |
| `--ring`                 | `colors.primary`         | `#5645d4` | Focus ring = purple (text-input-focused) |

New semantic tokens (not in shadcn defaults — add to `:root` **and** `@theme inline` as `--color-success` / `--color-warning`):

| New var                | DESIGN.md token           | Value     | Role                          |
| ---------------------- | ------------------------- | --------- | ----------------------------- |
| `--success`            | `colors.semantic-success` | `#1aae39` | Confirmed / classified status |
| `--success-foreground` | `colors.on-primary`       | `#ffffff` |                               |
| `--warning`            | `colors.semantic-warning` | `#dd5b00` | Pending / awaiting-review     |
| `--warning-foreground` | `colors.on-primary`       | `#ffffff` |                               |

Optional finer text ramp (only if a surface needs more than `foreground` +
`muted-foreground`): `colors.charcoal #37352f`, `colors.slate #5d5b54`,
`colors.stone #a4a097`. Add as needed; don't front-load tokens nothing uses.

**Implementation addendum — deep text tones (added as-needed per the ramp note):**
The mid-tone semantic colors fail WCAG AA as _text_ on light tints (success on
`/12` ≈ 2.6:1, warning ≈ 3.2:1) — using them for soft-tag badge text would
regress below the pre-change ink-on-white baseline (violating the accessibility
requirement). So colored-text-on-tint uses **deep** tones (mirroring DESIGN.md
`badge-tag-*`, which uses `brand-orange-deep` etc.), exposed as `--color-*-deep`:

| New var              | Value     | Source                     | AA on /12 tint |
| -------------------- | --------- | -------------------------- | -------------- |
| `--success-deep`     | `#0c6b28` | derived deep green         | 5.9:1 ✓        |
| `--warning-deep`     | `#793400` | `colors.brand-orange-deep` | 7.8:1 ✓        |
| `--destructive-deep` | `#991b1b` | derived deep red           | 7.0:1 ✓        |

Mid-tones (`--success`/`--warning`/`--destructive`) remain for fills, borders,
and tints (`bg-success/12`, `border-warning/30`); deep tones are text-only.

### D-DS-03: Status → semantic token mapping

Locked decision: colored statuses. Map each domain status to a token. Use the
**soft tag** treatment for table-cell badges (tinted background + deep text,
like DESIGN.md `badge-tag-*`) and solid for emphasis where appropriate.

| Surface   | Status value (UA label)                  | Token                           |
| --------- | ---------------------------------------- | ------------------------------- |
| Payments  | `classified` ("Класифіковано")           | success (green)                 |
| Payments  | `awaiting_review` ("На апрув")           | warning (orange)                |
| Payments  | `in_queue` ("У черзі")                   | primary/neutral                 |
| Payments  | "Отримано" (ingested, unprocessed)       | muted (neutral)                 |
| Payments  | "Пропущено" (skipped)                    | destructive/neutral             |
| Acts      | "Чернетка" (draft)                       | muted (neutral)                 |
| Acts      | "Відправлено в ЕДО"                      | warning (in-flight)             |
| Acts      | "Підписано"                              | success (green)                 |
| Acts      | "Видалено"                               | destructive (red)               |
| Dashboard | integration health: OK / degraded / down | success / warning / destructive |

Exact label↔status alignment to be confirmed against `lib/db/schema` enums
during implementation; the token intent above is the contract.

### D-DS-04: Font = Inter with Cyrillic subset

**Choice:** `next/font/google` Inter, `subsets: ["latin", "cyrillic"]`, bound to
`--font-sans`. Drop Geist Sans (it has no Cyrillic → serif fallback bug). Keep
Geist Mono only if a monospace surface still references it; otherwise remove.

**Why:** DESIGN.md specifies Notion Sans with an explicit Inter fallback chain
(`Inter, -apple-system, system-ui, …`). Notion Sans is proprietary; Inter is the
sanctioned substitute and ships Cyrillic. This both matches the design intent and
fixes the rendering defect.

**Note:** DESIGN.md "Don't replace Notion-Sans with a generic Inter" targets
brand-pixel-perfect marketing; for an internal admin with no Notion-Sans license,
Inter is the correct and documented choice.

### D-DS-05: Radius alignment

DESIGN.md: buttons/inputs `rounded.md` = 8px, cards `rounded.lg` = 12px. The
shadcn scale derives sizes from `--radius` (`--radius-md = radius*0.8`,
`--radius-lg = radius`). A single `--radius` can't hit both 8px and 12px exactly;
set `--radius: 0.75rem` (12px) so cards (`rounded-lg`) are exact and buttons
(`rounded-md` ≈ 9.6px) are within 2px of spec — acceptable. If exactness on
buttons matters more, document the tradeoff and pick `--radius` accordingly. Do
**not** introduce pill-shaped buttons (DESIGN.md "Don't"): pills are reserved for
filter tabs (`rounded-full`) and badges only.

### D-DS-06: Compliance guard (optional)

To stop regression, optionally add a check that fails CI when component files
contain raw hex colors or non-token Tailwind color shades (e.g.
`bg-[#...]`, `text-red-500`). Could be a lightweight grep step in the QA ritual
(`npm run qa`) or an ESLint rule. Deferrable to a follow-up if it expands scope.

### D-DS-07: Verification is visual

No logic changes → unit/integration tests are unaffected. Compliance is proven
by Chrome DevTools MCP screenshots of each surface (clients, payments, acts,
queue, dashboard, settings, login) for the PR "Real behavior proof" section
(D-037), ideally before/after pairs.

## Open Questions

- Exact UA label ↔ DB enum mapping for statuses (D-DS-03) — resolve against
  `lib/db/schema/{payments,acts}.ts` at implementation time.
- Keep or drop dark mode for this slice? Default: keep functional, don't
  brand-tune (Non-Goal).
- Adopt the compliance guard (D-DS-06) now or as a follow-up change?
