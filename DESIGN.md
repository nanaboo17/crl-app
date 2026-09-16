---
name: CRL Field App
description: Mobile-first field operations with friendly pastel Superadmin surfaces, clear hierarchy, rounded cards, compact data tables, and consistent chooser/reporting patterns.
colors:
  primary: "semantic daisyUI primary"
  secondary: "semantic daisyUI secondary"
  bg: "base-200"
  surface: "base-100"
  line: "base-300"
  text: "base-content"
typography:
  agent: "Inter / system-ui"
  superadmin: "Plus Jakarta Sans"
rounded:
  cards: "1rem–1.5rem"
  modal: "1.5rem"
  pills: "999px"
spacing:
  mobile: "compact"
  desktop: "comfortable"
---

# CRL Field App — Design System

_Last revised: 16 September 2026_

## 1. Product design direction

CRL is an operational field app, but the current UI intentionally avoids looking like a raw database console.

The visual direction combines:

- strong information hierarchy
- friendly pastel surfaces
- rounded cards
- compact but readable tables
- clear status pills
- accessible buttons and form controls
- responsive behavior for Agent mobile screens and Superadmin desktop/tablet screens

The interface should remain practical first. Decorative elements are acceptable when they support orientation and section identity, but they must not reduce data readability.

## 2. Typography

### Agent area

Use Inter/system-ui style typography with mobile readability as the priority.

### Superadmin area

Use Plus Jakarta Sans, scoped through the Superadmin layout.

Hierarchy:

- page title: bold and compact
- hero title: prominent but not oversized
- section heading: strong medium size
- KPI: large, heavy numeric emphasis
- body: readable 13–15px
- metadata: smaller and muted
- table headings: compact, uppercase/strong where useful

## 3. Color usage

Use daisyUI semantic tokens wherever possible:

- `base-100`
- `base-200`
- `base-300`
- `base-content`
- `primary`
- `secondary`

Superadmin pages may use soft pastel semantic sections and controlled gradients, especially in hero areas and summary cards.

Current examples include purple, blue, green, yellow, and orange-toned summary surfaces.

Avoid arbitrary high-saturation colors that compete with operational data.

## 4. Shape language

The current design uses a soft rounded shape system:

- standard cards: `rounded-2xl` / approximately 1rem
- hero and larger containers: approximately 1.25–1.5rem
- chooser modal: `rounded-3xl`
- small buttons: rounded rectangles
- status/count pills: fully rounded

Use one coherent rounded system within each page.

## 5. Shadows and borders

Most data surfaces use:

- subtle 1px border
- light shadow
- white/base surface

Chooser modals may use stronger shadow because they sit above the page.

Avoid strong floating shadows on every card.

## 6. Superadmin hero sections

Superadmin modules may use a pastel hero strip to establish context.

Typical structure:

- small uppercase kicker
- strong title
- short operational description
- small visual/emoji/icon scene on the right

The hero is contextual, not the primary data surface.

## 7. Summary/KPI cards

Summary grids should:

- use 2–4 cards depending on viewport
- pair an icon with one strong metric
- use soft pastel backgrounds
- use consistent spacing and radii
- collapse responsively on mobile

## 8. Tables

Operational tables must prioritize data access.

Rules:

- horizontal scrolling is acceptable for wide database views
- headers should remain compact and legible
- rows should have subtle separation
- avoid excessive row height
- long text should wrap rather than overflow the page
- mobile views may switch to cards when the table is not usable on a small screen

### Full-data date views

Visits by Date and Pre-Visits by Date intentionally show every current field from the corresponding Supabase table.

These tables use horizontal scrolling and Excel-style per-column filters.

## 9. Excel-style filters

Date reporting tables use a reusable Excel-like filter interaction.

Each column header can expose:

- searchable unique values
- multi-select values
- active-filter indicator
- clear filter
- select visible values

Multiple column filters can be active simultaneously.

The filtered table state should also drive CSV report generation.

## 10. Visit / Pre-Visit view chooser modal

Visits and Pre-Visits use the same chooser modal pattern.

Canonical visual structure:

```text
full-screen overlay
→ bg-black/40
→ backdrop-blur-sm
→ centered card
→ max-w-xl
→ rounded-3xl
→ base-100 surface
→ base-300 border
→ p-6 / sm:p-8
→ shadow-2xl
```

Inside the modal:

1. centered icon tile
2. centered title
3. short supporting description
4. two equal option cards
   - View by Date
   - View by Agent

Option cards use:

- `rounded-2xl`
- border
- `p-5`
- semantic hover border/background
- icon
- bold option title
- small supporting copy

When a new chooser is added elsewhere, reuse this same pattern instead of inventing a different modal style.

## 11. Buttons

Use daisyUI semantic button patterns when possible.

Typical hierarchy:

- primary: report generation / strong confirmation
- secondary: date action or secondary primary workflow
- ghost: navigation or low-emphasis utility actions

Buttons should have clear text labels. Icon-only actions require accessible labels/titles.

## 12. Status pills

Use status pills for quick scanning.

Examples:

- active/inactive
- counts
- workflow categories

Never rely on color alone; status text must be present.

## 13. Mobile Agent UI

Agent pages are mobile-first.

Priorities:

- one-column layout
- touch-friendly controls
- bottom navigation where applicable
- large form targets
- minimal horizontal scrolling
- GPS/camera workflows that work comfortably on a phone

## 14. Responsive Superadmin UI

Superadmin is desktop-first but must remain usable on tablets and smaller screens.

Common responsive behavior:

- 4 KPI cards → 2 → 1
- desktop table → mobile cards for Agent lists
- hero visual moves below content on narrow screens
- modal option cards stack on narrow screens
- wide full-data reports remain horizontally scrollable

## 15. Accessibility

Maintain:

- keyboard-focus visibility
- semantic headings
- `aria-modal` for chooser dialogs
- accessible labels for icon buttons
- readable contrast
- status text in addition to color
- sufficiently large touch targets

## 16. Design consistency rules

When adding or revising Superadmin modules:

1. Reuse `SuperadminPageHeader`.
2. Reuse existing semantic daisyUI tokens.
3. Use pastel summary cards only for summary information.
4. Keep data tables neutral and readable.
5. Use the canonical chooser modal for Date/Agent selection.
6. Use the shared Excel-style filter table for full Supabase date views.
7. Keep report buttons consistent across Visits and Pre-Visits.
8. Avoid one-off modal, card, or filter styles when a current pattern already exists.

## 17. Current canonical paired experiences

The following pairs should remain visually synchronized:

- Visits chooser ↔ Pre-Visits chooser
- Visits by Date ↔ Pre-Visits by Date
- Visit report button ↔ Pre-Visit report button
- Excel-style filters across both date tables

When one side is improved, evaluate whether the same design should be applied to the other side.
