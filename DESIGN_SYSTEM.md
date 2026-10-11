# Design System

> **Status:** Draft v0.2 · **Reference:** `Smart_Water_Redistribution_UI_Mockup.png` (the team's mockup, which labels itself "just a design idea").
> **Provenance labels used below:**
> **Sampled** = color measured from the mockup image ·
> **Adjusted** = started from the mockup, changed to meet contrast ·
> **Proposed** = not visible in the mockup, chosen here.
> Contrast ratios were computed against the token values (WCAG formula). Visual audits in a browser are still pending.

Related: [PRD.md](PRD.md) · [TECH_SPEC.md](TECH_SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TASKS.md](TASKS.md)

## Contents

1. [Principles](#1-principles)
2. [Information architecture](#2-information-architecture)
3. [Color](#3-color)
4. [Typography](#4-typography)
5. [Spacing and layout](#5-spacing-and-layout)
6. [Radius, borders, elevation](#6-radius-borders-elevation)
7. [Components](#7-components)
8. [States](#8-states)
9. [Charts and map](#9-charts-and-map)
10. [Icons and imagery](#10-icons-and-imagery)
11. [Responsive behavior](#11-responsive-behavior)
12. [Accessibility](#12-accessibility)
13. [Motion](#13-motion)
14. [Themes](#14-themes)
15. [Token implementation](#15-token-implementation)
16. [Do and don't](#16-do-and-dont)
17. [Mockup deviations and open items](#17-mockup-deviations-and-open-items)

## 1. Principles

Observed in the mockup:

1. **Light, airy, trustworthy.** Pale blue-white page, white cards, one deep navy anchor (the top bar).
2. **One action color.** A single saturated blue for buttons and links.
3. **Status by color plus word.** Pills read "Normal", "High Alert", "Shortage", "Adequate". Color is never alone.
4. **Numbers first.** Large KPI values with units in litres (L), a table beneath.
5. **Guided flow.** Home leads to Prediction, Anomalies, Shortage and Redistribution through "Quick Access" cards.

## 2. Information architecture

| Page | Purpose | PRD |
|---|---|---|
| Home / Dashboard | KPIs (total demand, available supply, estimated shortage, zones monitored), city select, quick access | PRD-006 |
| Demand Prediction | Date/period and zone selectors, multi-zone forecast chart, predicted-demand table with trend | PRD-002, PRD-009, PRD-012 |
| Abnormal Consumption | Zone table (current vs. normal range, status), spike alert banner | PRD-004, PRD-005 |
| Shortage Prediction | Predicted demand, available supply, shortage, status per zone; total shortage note | PRD-006, PRD-007 |
| Redistribution Plan | Available supply, priority zones, allocation table, constraints note | PRD-008, PRD-010 |
| Map and Visualizations | Zone map with risk markers, key insights, trend chart, weather impact | PRD-009, PRD-011, PRD-013 |
| Report Wastage (new, not in mockup) | Own page at `/report`. Photo drop zone, location picker, category, severity, description, submit, confirmation with report ID | PRD-016, PRD-021 |
| Track Report (new) | Own page at `/report/track`. Enter report ID to see status | PRD-020 |
| MCD Reports (new) | Own page at `/mcd/reports`, passcode-protected, not linked in the public nav | PRD-017 |

Global navigation: Home · Prediction · Analysis · Map · **Report** · About, plus a user/profile icon (the Report link uses the same nav style; no special color).

Home page: add a fifth "Quick Access" card "Report Water Wastage" linking to `/report` (the mockup shows four cards; keep the grid at 4 columns on desktop and wrap the fifth).

## 3. Color

### 3.1 Core and surface tokens

| Token | Value | Provenance | Use |
|---|---|---|---|
| `color.nav.background` | `#012A5C` | Sampled | Top navigation bar |
| `color.nav.text` | `#FFFFFF` | Sampled | Nav links |
| `color.background` | `#F3F8FE` | Sampled | Page background |
| `color.surface` | `#FFFFFF` | Sampled | Cards, tables |
| `color.surface.muted` | `#F7FAFB` | Sampled | KPI cards, table header |
| `color.border` | `#DCE5EF` | Proposed | Card and table dividers (decorative) |
| `color.border.input` | `#7C8EA8` | Proposed | Input and select borders (≥ 3:1) |
| `color.text.primary` | `#0B1F3A` | Adjusted | Headings and body |
| `color.text.secondary` | `#5A6B8B` | Sampled | Descriptions, labels |
| `color.primary` | `#0867C4` | Adjusted | Buttons, links, selected state |
| `color.primary.image-ref` | `#0277E0` | Sampled | Reference only; **do not use for text-on-button** |
| `color.primary.hover` | `#0553A0` | Proposed | Hover and pressed |

### 3.2 Status tokens (pills, banners, map)

Pill backgrounds are the mockup's pastel fills (**Sampled**); text colors are darkened
(**Adjusted**) so each pair reaches at least 4.5:1.

| Status | Where used in the mockup | `bg` | `text` | Contrast |
|---|---|---|---|---|
| `status.success` | Normal, Adequate | `#D5F6D8` | `#14632F` | 6.3 |
| `status.danger` | High Alert, Shortage | `#FDC8C8` | `#9B1C2C` | 5.5 |
| `status.warning` | High (amber), Medium risk | `#FFE3C2` | `#8A4B00` | 5.5 |
| `status.caution` | Slight shortage | `#FEF2D7` | `#7A5200` | 6.2 |
| `status.info` | Info banners, "Available for redistribution" box | `#E8F3FE` | `#0553A0` | 6.8 |
| `status.anomaly` | Abnormal marker (not in mockup) | `#EFE7FA` | `#6B3FB5` | 5.8 |

Banner backgrounds (**Sampled**): alert `#FDF5F8`, priority-zones box `#FDF4F7`, note/info-green `#F0FBFA`.

> The mockup shows both "High Alert" (red) and "High" (amber) for abnormal zones. Define them in the data model before
> building (see [section 17](#17-mockup-deviations-and-open-items)).

### 3.3 Value and series tokens

| Token | Value | Contrast on white |
|---|---|---|
| `color.value.positive` (e.g. available supply) | `#1C8748` | 4.6 |
| `color.value.negative` (e.g. estimated shortage) | `#C62828` | 5.6 |
| `color.trend.increase` | `#C62828` | 5.6 |
| `color.trend.stable` | `#5A6B8B` | 5.4 |
| `color.trend.decrease` | `#1C8748` | 4.6 |
| `color.series.1` (Zone A) | `#1F6FDB` | 4.8 |
| `color.series.2` (Zone B) | `#1C8748` | 4.6 |
| `color.series.3` (Zone C) | `#C96100` | 4.0 |
| `color.series.4` (Zone D) | `#7B5CD6` | 4.8 |
| `color.series.5` (Zone E) | `#D9363E` | 4.6 |

Series colors follow the mockup's order and hue family; green, orange and red were darkened to reach at least 3:1 against white (graphics threshold).
Trend direction in the mockup is unconfirmed (arrow colors were hard to read), so the increase = red, decrease = green mapping is **Proposed**.

## 4. Typography

The mockup uses a clean geometric sans-serif (Inter-like; exact font **Unconfirmed**).

| Token | Value |
|---|---|
| `font.family.base` | `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (Proposed; system fallback keeps it working offline) |
| `font.family.mono` | `ui-monospace, "SF Mono", Consolas, monospace` |

| Token | Size / line height | Weight | Use (mockup reference) |
|---|---|---|---|
| `font.size.display` | 32 / 40 | 700 | Hero headline "Smarter Water for a Better Tomorrow" |
| `font.size.title` | 24 / 32 | 700 | Page titles ("Demand Prediction") |
| `font.size.heading` | 18 / 26 | 600 | Section headings ("Predicted Water Consumption") |
| `font.size.metric` | 28 / 36 | 700 | KPI values ("1,850,000 L") |
| `font.size.body` | 16 / 24 | 400 | Body |
| `font.size.small` | 14 / 20 | 400 | Table cells, descriptions |
| `font.size.caption` | 12 / 16 | 500 | Labels, pill text, axis ticks |

Use tabular numerals in tables. Always show the unit (L) next to quantities.

## 5. Spacing and layout

Base unit 4 px (**Proposed**).

| Token | Value |
|---|---|
| `spacing.1` | 4 px |
| `spacing.2` | 8 px |
| `spacing.3` | 12 px |
| `spacing.4` | 16 px |
| `spacing.6` | 24 px |
| `spacing.8` | 32 px |

Layout patterns from the mockup:

- **Top nav:** full-width bar, brand left (drop icon + "Smart Water Redistribution"), links right.
- **Page body:** single column, max content width `1200px`, centered.
- **KPI row:** 4 equal cards on desktop.
- **Quick access:** 4 equal cards below the KPI row.
- **Map page:** map (about two thirds) beside a "Key Insights" panel, trend chart and weather card below.

## 6. Radius, borders, elevation

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 6 px | Pills use `radius.full` instead; inputs, small tags |
| `radius.md` | 10 px | Buttons, cards, banners |
| `radius.lg` | 14 px | Hero and large panels |
| `radius.full` | 999 px | Status pills |
| `border.default` | `1px solid color.border` | Cards, tables |
| `shadow.card` | `0 2px 8px rgba(11, 31, 58, 0.06)` | Cards (soft, as in the mockup) |
| `shadow.dialog` | `0 12px 32px rgba(11, 31, 58, 0.18)` | Dialogs |

Radius and shadow values are visual estimates, **Proposed**.

## 7. Components

| Component | Specification |
|---|---|
| **Top navigation** | Background `color.nav.background`; white links at `font.size.small`; active link underlined or bold; brand with water-drop icon. |
| **Primary button** | Fill `color.primary`, white text 600, `radius.md`, height 40 px. Used for Predict, Get Started, View Details. |
| **Select / dropdown** | White, `border.input`, `radius.sm`, label above in `text.secondary` (e.g. "Select Zone", "Select City"). |
| **KPI card** | `surface.muted`, `shadow.card`; icon left, label (`caption`, secondary), value (`metric`) with unit. Value color from §3.3 only when meaning applies. |
| **Quick-access card** | Icon (colored), bold title, one-line description; whole card is a link. |
| **Data table** | Header row `surface.muted`, `small` text, row dividers `color.border`, numbers right-aligned, status in last column. |
| **Status pill** | `radius.full`, `caption` weight 600, bg and text from §3.2. |
| **Trend cell** | Arrow icon plus word ("Increase", "Stable", "Decrease"); arrow never alone. |
| **Alert banner** | `#FDF5F8` background, red icon, bold headline, detail line, primary button on the right. Example text pattern: "Unusual spike detected in Zone B". |
| **Info / note banner** | Light blue or light teal background, info icon, short text. For capacity constraints and totals. |
| **Chart panel** | See [section 9](#9-charts-and-map). |
| **Map markers** | Pin per zone, colored by risk (High red, Medium orange, Low green), zone label beside it. |
| **Key insights panel** | Icon plus one-sentence insight list (highest shortage, surplus, total shortage, recommended transfer). |
| **Weather card** | Large temperature, condition icon and label, one line on demand impact. |
| **Location picker** | Map with a draggable pin, a "Use my location" button, and an address/landmark text field. Pin uses `color.primary`. Coordinates are shown as text for screen-reader users. Falls back to text address when geolocation is denied or unavailable. |
| **Category chips** | Group of selectable chips: Burst pipe, Leak, Overflow, Other. Single-select. Selected chip: `status.info` fill with `color.primary` border. |
| **Severity selector** | Radio group or pill: Minor leak / Heavy flow. Clear helper text. |

## 8. States

| State | Rule |
|---|---|
| Default | Per component spec |
| Hover | Primary button → `color.primary.hover`; table rows and cards get `color.background` |
| Focus | 2 px outline `color.primary`, 2 px offset; never removed |
| Active | One step darker; no layout shift |
| Disabled | 40% opacity, `not-allowed` cursor, tooltip explaining why |
| Loading | Skeleton rows or spinner plus text ("Predicting…"); keep layout height stable |
| Error | `status.danger` banner with icon, cause and next step |
| Empty | Short message with the action to fix it (e.g. "No forecast yet. Choose a period and select Predict") |

## 9. Charts and map

- One line per zone using `color.series.1`–`5`. Legend at top right, as in the mockup.
- Do not rely on hue alone: also support hover labels and a "show one zone" filter. Dashed line style for the comparison series.
- Actual vs. predicted (zone trend chart): actual solid blue, predicted solid red in the mockup. To avoid confusion with risk red, this system uses **actual = `color.series.1` solid** and **predicted = `color.primary.hover` dashed** (**Adjusted**).
- Axis titles with units (`Water (Litres)`), light gridlines (`color.border`).
- Mark anomalous points with `status.anomaly` markers.
- Mark the forecast start with a vertical line.
- Provide a data-table or text summary alternative for each chart.
- Map: keyless tile layer; marker legend (High / Medium / Low risk) top right; marker click opens zone summary.

## 10. Icons and imagery

- One outline icon style, 20–24 px, colored by meaning (blue default, red alert, green positive).
- Hero image: water tower and city skyline photograph (as in mockup). Image source and license: **TBD**; use a licensed or own photo.
- Meaningful icons carry an accessible name; decorative ones are hidden from assistive tech.

## 11. Responsive behavior

| Breakpoint | Token | Behavior |
|---|---|---|
| < 640 px | `bp.sm` | Nav collapses to a menu; KPI and quick-access cards stack; tables scroll horizontally; map above insights |
| 640–1023 px | `bp.md` | 2-column card grids; map and insights stack |
| ≥ 1024 px | `bp.lg` | Layout as in the mockup |

Primary target: desktop and tablet for the demo. Phone support level: TBD.

## 12. Accessibility

Verified numerically (WCAG formula) on the token values in this file:

| Pair | Ratio | Target |
|---|---|---|
| White on `color.primary` `#0867C4` | 5.6 | 4.5 ✔ |
| White on `color.primary.image-ref` `#0277E0` | 4.45 | 4.5 ✘ (hence the adjustment) |
| White on `color.nav.background` | 14.1 | 4.5 ✔ |
| `text.primary` on white / page bg | 16.5 / 15.5 | 4.5 ✔ |
| `text.secondary` on white / page bg | 5.4 / 5.0 | 4.5 ✔ |
| Link `color.primary` on page bg | 5.3 | 4.5 ✔ |
| Status pill text on its fill | 5.5 – 6.8 | 4.5 ✔ |
| Chart series on white | 4.0 – 4.8 | 3.0 ✔ |

Rules:

- Keyboard operation for all controls; visible focus (§8).
- Status conveyed by text plus color; trend by word plus arrow.
- Form controls have visible labels.
- The location picker must be fully usable without the map: address field plus "Use my location" (or manual lat/lon inputs) must be enough to submit, keyboard-accessible, and screen-reader labeled.
- `color.border.input` is `#7C8EA8` (3.3:1) so input edges are visible.
- Not yet verified: screen reader behavior, zoom to 200%, real browser rendering.

## 13. Motion

150 ms ease-out for hover and focus. Chart updates fade or draw once; no looping animation.
Respect `prefers-reduced-motion`.

## 14. Themes

Light theme only (as in the mockup). Dark theme: Planned, not required.

## 15. Token implementation

Define tokens once as CSS custom properties; reuse them for charts.

```css
:root {
  --color-nav-background: #012A5C;
  --color-background: #F3F8FE;
  --color-surface: #FFFFFF;
  --color-border: #DCE5EF;
  --color-text-primary: #0B1F3A;
  --color-text-secondary: #5A6B8B;
  --color-primary: #0867C4;
  --color-primary-hover: #0553A0;
  --status-success-bg: #D5F6D8;  --status-success-text: #14632F;
  --status-danger-bg:  #FDC8C8;  --status-danger-text:  #9B1C2C;
  --radius-md: 10px;
  --shadow-card: 0 2px 8px rgba(11, 31, 58, 0.06);
  --spacing-4: 16px;
}
```

Naming: dotted names in this document (`color.risk`-style) map to kebab-case CSS variables
(`color.text.primary` → `--color-text-primary`). Put the CSS variables in static/css/tokens.css and load it in the base template.

## 16. Do and don't

| Do | Don't |
|---|---|
| Show "Shortage · 300,000 L" in a pill | Show a red number with no label |
| Put units (L) next to every quantity | Mix litres and cubic metres |
| Use `status.anomaly` for abnormal consumption and `status.danger` for shortage | Reuse one red for both |
| Keep one primary button per section | Add several competing blue buttons |
| Sort zone tables by risk first | Sort alphabetically by default |
| Keep cards white on the pale page background | Nest cards inside cards |

## 17. Mockup deviations and open items

| # | Item | Decision |
|---|---|---|
| 1 | Primary blue `#0277E0` fails 4.5:1 with white text (4.45) | Use `#0867C4` (Adjusted) |
| 2 | "High Alert" (red) and "High" (amber) both appear for abnormal zones; the meaning of each is unspecified | Open: define anomaly severity levels in [TECH_SPEC.md](TECH_SPEC.md) |
| 3 | Actual vs. predicted uses blue vs. red; red clashes with risk red | Adjusted (see §9) |
| 4 | "Select City" (Thane) on Home implies multi-city support, which is not in the PRD | Open: confirm or drop |
| 5 | Mockup numbers are illustrative and inconsistent between pages (e.g. shortage 230,000 L on Home vs. 450,000 L on Shortage page) | Do not copy as data |
| 6 | Mockup targets Flask, HTML, CSS, JS | Resolved: Flask |
| 7 | Chart legends and axis labels in the mockup are small | Minimum 12 px in implementation |
| 8 | Profile icon in nav | Unconfirmed; remove if no accounts |
