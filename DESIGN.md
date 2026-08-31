---
name: CRL Field App
description: Neutral, data-dense field-operations interface. Inter typography, slate neutrals, borders over shadows, daisyUI semantic tokens for admin surfaces.
colors:
  primary: "#111827"
  bg: "#F4F6F8"
  surface: "#FFFFFF"
  surface-soft: "#F8FAFC"
  text: "#111827"
  muted: "#667085"
  line: "#E4E7EC"
  danger: "#B42318"
  danger-soft: "#FFF1F0"
  success-soft: "#ECFDF3"
typography:
  page-title: { fontFamily: Inter, fontSize: 24px, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.025em }
  kpi: { fontFamily: Inter, fontSize: 28px, fontWeight: 850, lineHeight: 1, letterSpacing: -0.03em }
  section-title: { fontFamily: Inter, fontSize: 16px, fontWeight: 700 }
  body-md: { fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  label-sm: { fontFamily: Inter, fontSize: 12px, fontWeight: 700, lineHeight: 1.35 }
  label-xs-uppercase: { fontFamily: Inter, fontSize: 11px, fontWeight: 750, letterSpacing: 0.08em }
rounded: { sm: 9px, md: 12px, lg: 14px, xl: 18px, full: 999px }
spacing: { sm: 8px, md: 16px, lg: 24px }
components:
  navbar-superadmin:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    height: 64px
  avatar-initials:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    size: 36px
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.xl}"
    padding: 17px
  status-pill:
    backgroundColor: "#F2F4F7"
    textColor: "#344054"
    rounded: "{rounded.full}"
---

# CRL Field App

## Overview
Internal field-operations tool (agents visit customers; superadmins manage agents, customers,
visits). Utility over decoration: dense readable data, calm neutrals, one dark ink accent.
Two surfaces share one language: mobile-first agent pages (handwritten CSS classes in
globals.css) and superadmin desktop pages (daisyUI semantic classes: `base-100/200/300`,
`base-content`, `btn-primary`). daisyUI defaults must not be re-themed per-component.

## Colors
- **Primary (#111827):** dark slate ink — buttons, avatars, brand marks. Never gradients.
- **Surface (#FFFFFF) on Bg (#F4F6F8):** page/layer separation via tonal steps and 1px `line` borders, not heavy shadow.
- **Muted (#667085):** secondary text, labels, eyebrows. Minimum body contrast is WCAG AA.
- **Danger (#B42318) + danger-soft:** destructive actions only (logout, deactivate, errors).

## Typography
- Inter everywhere; system-ui fallback. Headline weights 800–850 with slight negative tracking; body 400/14–15px.
- **Superadmin area uses Plus Jakarta Sans** (scoped via next/font in `app/superadmin/layout.tsx`); same hierarchy, daisyUI semantic classes for components.
- Uppercase letter-spaced eyebrows/labels (`label-xs-uppercase`) mark sections and roles.

## Layout
- Mobile agent app: single column, `.mobile-page` max-width 720px, bottom tab nav, 50px touch targets.
- Superadmin desktop: `max-w-6xl` content column on `base-200`; sticky top navbar (`navbar-superadmin`, 64px).
- Spacing scale 8/16/24; card gaps 12–18px.

## Elevation & Depth
- Flat. `shadow-sm` max on persistent chrome (navbar); cards rely on border + `0 1px 2px` shadow.
- No glassmorphism, no colored glows.

## Shapes
- Radii 12–18px on cards/forms; `full` for avatars and status pills. Never mix sharp and rounded in one view.

## Components
- **Navbar (superadmin):** brand link left (ghost button, normal-case), avatar dropdown right; initials avatar (`avatar-initials`) — no photo assets exist. Menu shows name/email/role, dashboard link, logout (danger text).
- **Buttons:** primary solid ink, secondary gray fill, outline for tertiary; full-width stacks on mobile.
- **Cards:** surface + line border + xl radius; stat cards lead with `label-sm` and a `kpi` figure.
- **Status pills:** neutral gray default; green/red soft fills only for active/inactive semantics.

## Do's and Don'ts
- Do keep one primary action per screen; everything else secondary/outline.
- Don't add gradients, glassmorphism, decorative animation, or rainbow badge colors.
- Don't re-theme daisyUI components with ad-hoc hex values — use semantic tokens.
- Do show role/state as text (or text+color), never color alone.
- Do keep keyboard focus visible (daisyUI default outlines) on dropdowns and buttons.
