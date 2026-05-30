# design-system Specification

## Purpose

Wire the authoritative `DESIGN.md` design system into the running app. Defines
the accepted behavior for the token foundation in `app/globals.css` (color
palette, semantic status colors, radius scale, focus ring), the Cyrillic-capable
sans-serif typeface bound to `--font-sans`, and the typography scale applied
across pages — so the live app matches the documented system and the "no hex
literals / no ad-hoc Tailwind shades outside the token-mapping layer" rule from
`AGENTS.md` is actually enforceable.

## Requirements

### Requirement: Color tokens follow the DESIGN.md palette

The application's theme variables in `app/globals.css` SHALL map to the
`DESIGN.md colors.*` palette for the internal-admin subset. The primary accent
SHALL be `colors.primary` (`#5645d4`, purple), surfaces SHALL use the
warm-neutral ramp (`canvas`/`surface`/`hairline`), and text SHALL use
`ink`/`charcoal`/`steel`. No grayscale stand-ins (`oklch(L 0 0)`) for brand
colors SHALL remain. Hex literals are permitted **only** inside the CSS-variable
token-mapping layer, never in component markup.

#### Scenario: Primary accent is purple

- **WHEN** the operator views any primary CTA (e.g. "+ Новий клієнт", "Додати тариф") or the active nav/filter state
- **THEN** its background SHALL render `colors.primary` (`#5645d4`), not near-black

#### Scenario: No grayscale brand placeholder remains

- **WHEN** `--primary` in `:root` is inspected
- **THEN** it SHALL resolve to the purple brand value, not `oklch(0.205 0 0)`

#### Scenario: Component markup contains no raw color literals

- **WHEN** component files under `app/` are searched for hex literals or ad-hoc Tailwind color shades (e.g. `bg-[#...]`, `text-red-500`)
- **THEN** none SHALL be found outside the `globals.css` token-mapping layer

### Requirement: Semantic status colors

The system SHALL define `--success` (`colors.semantic-success`, `#1aae39`) and
`--warning` (`colors.semantic-warning`, `#dd5b00`) tokens in addition to the
shadcn-default `--destructive` (`colors.semantic-error`, `#e03131`), expose them
through `@theme inline`, and apply them to payment status badges, act status
badges, and dashboard integration-health banners.

#### Scenario: Classified payment shows success color

- **WHEN** the operator views a payment with status `classified` on `/payments`
- **THEN** its status badge SHALL render with the success (green) token

#### Scenario: Awaiting-review payment shows warning color

- **WHEN** the operator views a payment with status `awaiting_review` ("На апрув")
- **THEN** its status badge SHALL render with the warning (orange) token

#### Scenario: Signed act shows success, deleted act shows destructive

- **WHEN** the operator views acts with statuses "Підписано" and "Видалено" on `/acts`
- **THEN** the signed act badge SHALL use the success token and the deleted act badge SHALL use the destructive token

#### Scenario: Degraded integration health surfaces warning

- **WHEN** the dashboard renders an integration whose health is "degraded"
- **THEN** its health banner SHALL use the warning token; a "down" integration SHALL use the destructive token; a healthy one the success token

### Requirement: Typeface renders Cyrillic in sans-serif

The application SHALL load Inter (the documented Notion-Sans fallback) with the
`cyrillic` subset bound to `--font-sans`. Ukrainian text SHALL render in the
intended sans-serif on every surface, with no serif system-font fallback.

#### Scenario: Ukrainian heading is sans-serif

- **WHEN** the operator views a page-title heading containing Cyrillic (e.g. "Клієнти", "Платежі", "Акти")
- **THEN** it SHALL render in Inter (sans-serif), not a serif fallback

#### Scenario: Geist Cyrillic fallback is eliminated

- **WHEN** the font bound to `--font-sans` is inspected
- **THEN** it SHALL be Inter with a `cyrillic` subset, not Geist Sans

### Requirement: Typography scale follows DESIGN.md tiers

Page-level and section headings SHALL use the `DESIGN.md typography.*` tiers
(page titles at `heading-2`, section/card titles at the appropriate tier) rather
than ad-hoc Tailwind size utilities chosen per page.

#### Scenario: Page title uses heading tier

- **WHEN** the operator views a page title (e.g. "Клієнти")
- **THEN** its size, weight, and tracking SHALL match a `DESIGN.md typography.*` tier (heading-2: 36/600/-0.5px or the chosen page-title tier), applied consistently across all top-level pages

### Requirement: Shape geometry follows DESIGN.md radius scale

Buttons and inputs SHALL render at `rounded.md` (8px, within a 2px tolerance per
the single-`--radius` derivation), and cards SHALL render at `rounded.lg` (12px).
Pill geometry (`rounded.full`) SHALL be reserved for filter tabs and badges only;
regular buttons SHALL NOT be pill-shaped.

#### Scenario: Buttons are rounded rectangles, not pills

- **WHEN** the operator views a CTA button
- **THEN** it SHALL have an ~8px corner radius, not a fully-rounded pill shape

#### Scenario: Cards use the large radius

- **WHEN** the operator views a card or panel surface (e.g. settings tariff grid, dashboard cards)
- **THEN** it SHALL render at a 12px corner radius

#### Scenario: Filter tabs remain pills

- **WHEN** the operator views the filter tabs on `/clients` or `/payments` (Активні / Архів / Усі …)
- **THEN** they SHALL keep the pill (`rounded-full`) shape with the active tab using the primary/ink-deep treatment per DESIGN.md `pill-tab-active`

### Requirement: Focus and accessibility preserved under the new palette

Interactive elements SHALL show a visible focus ring in `colors.primary`
(purple, per DESIGN.md `text-input-focused`), and text/background pairings SHALL
remain legible. The recolor SHALL NOT reduce focus visibility or text contrast
below the pre-change baseline.

#### Scenario: Focused input shows purple ring

- **WHEN** the operator focuses a text input or search field
- **THEN** a visible focus indicator in `colors.primary` SHALL appear

#### Scenario: Body text remains legible

- **WHEN** primary body text renders on the canvas/surface backgrounds
- **THEN** the `ink`/`charcoal` on `canvas`/`surface` pairing SHALL meet at least WCAG AA contrast for normal text
