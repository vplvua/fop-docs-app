## Why

[`DESIGN.md`](../../../DESIGN.md) is declared the authoritative design system in
[`AGENTS.md`](../../../AGENTS.md) and [`openspec/project.md`](../../project.md),
but it was never wired into the app. `app/globals.css` still ships the **stock
shadcn "neutral" theme** — every color is `oklch(L 0 0)` (zero chroma = pure
grayscale), `--primary` is near-black instead of the signature purple, and
`app/layout.tsx` loads **Geist**, which lacks Cyrillic glyphs, so Ukrainian
headings fall back to a system serif (visible as serif "Клієнти"/"Платежі"
headers).

The result: the live app (`project-qmooi.vercel.app`) looks nothing like the
documented system, and the AGENTS.md rule "no hex literals, no ad-hoc Tailwind
shades outside token mapping" is silently unenforced because the token layer
itself is the default starter.

Good news: components are written against **semantic shadcn variables**
(`bg-primary`, `text-foreground`, `border-border`, `bg-card`,
`text-muted-foreground`) with no hex literals and no per-page color. So bringing
the app into compliance is a **token remap in `globals.css` + a font swap**, not
a redesign of 16 pages.

## What Changes

- **Token foundation (`app/globals.css`):** remap the shadcn CSS variables in
  `:root` to the DESIGN.md `colors.*` palette — purple `#5645d4` primary,
  warm-neutral surfaces (`canvas`/`surface`/`hairline`), ink/charcoal/slate/
  steel text ramp, purple focus ring. Add the missing **semantic tokens**
  (`--success`, `--warning`) and expose them through `@theme inline`.
- **Font (`app/layout.tsx`):** replace Geist with **Inter** (the documented
  Notion-Sans fallback) loaded with the `cyrillic` subset, so Ukrainian renders
  in the intended sans-serif. Keep Geist Mono for monospace only if still used.
- **Radius scale:** align `--radius` so buttons/inputs land at `rounded.md`
  (8px) and cards at `rounded.lg` (12px) per DESIGN.md.
- **Semantic status colors:** apply `semantic-success`/`warning`/`error` +
  neutral to payment status badges, act status badges, and dashboard health
  banners (currently all monochrome outline pills).
- **Typography scale:** map the heading sizes used across pages to the
  DESIGN.md `typography.*` tiers (heading-2 for page titles, etc.) where they
  currently use ad-hoc Tailwind `text-2xl` values.
- **Compliance guard (optional, see design D-DS-05):** a lint/check so future
  UI work can't reintroduce raw hex/grayscale outside the token layer.

**Scope is the internal-admin subset of DESIGN.md only.** Marketing surfaces —
navy hero band, pastel feature cards, pricing comparison tables, multi-column
footer, workspace-mockup cards — are explicitly out of scope (the app has no
such pages).

**Locked decisions** (from exploration): primary accent = purple `#5645d4`;
status/badge colors = semantic (green/orange/red), not monochrome.

## Capabilities

### New Capabilities

- `design-system`: Token foundation (color, typography, radius, elevation),
  font loading, and component-styling compliance with `DESIGN.md` for all
  internal-admin surfaces. Defines what "matches the design system" means as
  verifiable behavior.

### Modified Capabilities

_(none — this is a presentation-layer change; no domain behavior changes.
Existing capability specs (`clients`, `payments-ingest`, `acts`, `queue`,
`dashboard`, `settings`, `tariffs`) keep their behavioral contracts; only their
rendered appearance changes.)_

## Impact

- **CSS:** `app/globals.css` — remap `:root` vars, add semantic tokens + `@theme`
  entries, adjust `--radius`.
- **Layout:** `app/layout.tsx` — Inter font swap with `cyrillic` subset.
- **UI components:** status-badge / banner styling in `payments`, `acts`,
  `queue`, dashboard surfaces switch to semantic tokens. `top-bar.tsx` queue
  counter + active-nav accent move to purple. Page-title headings adopt the
  type scale. Markup structure largely unchanged (semantic classes already in
  place).
- **Tests:** no unit/integration logic changes. Verification is visual — Real
  behavior proof via Chrome DevTools MCP screenshots of each surface
  before/after (per D-037 PR rule).
- **Dependencies:** `geist` font package may be droppable; add `next/font`
  Inter (already part of `next/font/google`, no new npm dep).
- **No DB, no migration, no API changes.**
