# PeopleOps — Design System Analysis

Status: Phase 0 deliverable.

Two sources exist for visual direction: the verified design tokens of `@nemo-ui/ui`, and the Figma
community kit "SmartHR". **Only the first has been inspected.** The Figma file is not reachable from
this environment (host resolves to a blocked address), so no layout claims about it are made here.

## 1. Verified token system (`@nemo-ui/ui` 0.1.0)

Exported from the package (`foundations/*`, `theme/*`), so these values are facts, not guesses.

### Color

| Token | Value |
| --- | --- |
| `colors.primary[500]` | `#4285F4` (600 `#1A73E8`, 700 `#1967D2`) |
| `colors.secondary[500]` | `#8B5CF6` |
| `colors.neutral[0]` | `#FFFFFF` |
| `colors.neutral[50]` | `#F8F9FA` |
| `colors.neutral[100]` | `#F1F3F4` |
| `colors.neutral[200]` | `#E8EAED` (typical border) |
| `colors.neutral[500]` | `#9AA0A6` (muted text) |
| `colors.neutral[700]` | `#5F6368` (secondary text) |
| `colors.neutral[900]` | `#202124` (primary text) |
| `colors.success` | `#34A853` |
| `colors.warning` | `#FBBC04` |
| `colors.error` | `#EA4335` |
| `colors.info` | `#4285F4` |

Semantic surface tints for alerts exist (`colors.surface.success|warning|error`). Dark mode ships a
parallel palette; components flip automatically under `ThemeProvider mode="dark"` and respect
`prefers-color-scheme`.

Named palettes are also exported (`palette.sapphireOceanSerenity`, `deepSea`, `monochromeRed`,
`cinnamon`, ...) and can override the default theme via `ThemeProvider theme={...}`. PeopleOps keeps
the **default** palette in early phases; no custom brand palette until the Figma file is available.

### Spacing (4px base)

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px — exposed as `spacing[0..24]`.

Layout consequences: page padding 24px (32px on ≥1024px), card padding 24px, form row gap 16px,
section gap 32px, table cell padding from the component (no ad-hoc values in app code).

### Radius

`none 0`, `sm 4px`, `md 8px`, `lg 12px`, `xl 16px`, `full 9999px`.

Cards → `md`/`lg`. Inputs and buttons are styled by the library. Pills/badges → `full`.

### Shadows

`sm 0 1px 2px rgba(0,0,0,.05)`, `md 0 4px 6px rgba(0,0,0,.1)`, `lg 0 10px 15px rgba(0,0,0,.1)`,
`xl 0 20px 25px rgba(0,0,0,.1)`. Use `sm` for sticky header elevation, `md` for popovers (library
handles its own), avoid stacking heavy shadows.

### Typography scale

| Token | Size / line-height / weight |
| --- | --- |
| display | 56 / 64 / 700 |
| heading1 | 40 / 48 / 700 |
| heading2 | 32 / 40 / 700 |
| heading3 | 24 / 32 / 600 |
| heading4 | 20 / 28 / 600 |
| heading5 | 18 / 24 / 600 |
| heading6 | 16 / 24 / 600 |
| body | 16 / 24 / 400 |
| bodySmall | 14 / 20 / 400 |
| caption | 12 / 16 / 400 |
| overline | 12 / 16 / 600, uppercase, 0.1em |
| button | 14 / 20 / 600 |

`Typography` variants map to `h1`–`h6`, `body`, `bodySmall`, `caption`, `overline`, `button`, with a
semantic `as` prop. Page titles use `h4`/`h5` (not `h1`) inside the app shell where the product name
is the document title; each page keeps exactly one `h1` for accessibility via `as="h1"` when needed.

### Breakpoints, motion, layering

Breakpoints: `xs 480`, `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
Motion: `fast 120ms`, `normal 200ms`, `slow 300ms`, standard easing curves.
z-index: dropdown 1000, sticky 1100, fixed 1200, modal 1300, popover 1400, tooltip 1500.
Opacity: disabled 0.4, hover 0.9, pressed 0.8.

## 2. Application layout system (derived, to be confirmed against Figma)

These are engineering decisions that keep 12 modules visually consistent, not claims about the
reference file:

- **App shell**: fixed left sidebar, 264px wide (`lg` and up), collapsible to 72px icon rail; below
  `lg` it becomes a `Drawer` opened from the topbar.
- **Topbar**: 64px tall, sticky, contains page breadcrumb, global search entry point, notification
  menu (`Menu`), user menu (`Avatar` + `Menu`). Background `neutral[0]`, bottom border
  `neutral[200]`, `shadow.sm` when scrolled.
- **Content area**: max-width 1440px, padding 24px (32px at `lg`+), vertical rhythm from the spacing
  scale.
- **Page pattern**: `PageHeader` (title + description + primary action) → optional filter bar →
  content card(s). One primary action per page.
- **Navigation grouping**: Home/Dashboard · People (Employees, Organization) · Time (Attendance,
  Leave, Overtime, Approvals) · Payroll · Growth (Performance, Learning) · Reports · Administration
  (Users, Roles, Settings). Items are permission-filtered.
- **Density**: tables use `size="md"` on desktop and `"sm"` on dense screens; 10–20 rows per page.
- **Responsive**: below `md`, tables scroll horizontally (no card collapse in Phase 1), forms become
  single-column, filter bars stack.

## 3. Screen composition patterns

| Screen | Composition |
| --- | --- |
| Dashboard | 4 stat `Card`s (`Stack` row, wrapping) + attendance summary + pending approvals list + birthdays/anniversaries |
| Employee directory | `PageHeader` + filter bar (`Input` search, `Select` department/status, `DatePicker`) + `Table` with server pagination + row `Menu` actions |
| Employee profile | Header card (avatar, name, position, `Badge` status) + `Tabs` (Overview, Employment, Documents, Attendance, Leave, Payslips) |
| Create/edit employee | Multi-step or sectioned form: `Card` sections, `FormField` + `Input`/`Select`/`DatePicker`/`FileUpload`, sticky footer actions |
| Leave request | `Modal` (small flows) or dedicated page (multi-step); balance shown as a summary card before submit |
| Approvals inbox | List with filters, row click opens `Drawer` with detail + approve/reject actions |
| Payroll run | Period `Select`, preview `Table` with totals, publish guarded by `Modal` confirmation |
| Settings | `Tabs` + form sections, destructive actions use a confirmation `Modal` |

Every list renders loading (`Skeleton`), empty (`Table` `emptyText` + a guidance `Alert` where
useful), error (`Alert` tone error + retry) and success states.

## 4. Accessibility rules

- Color is never the only status signal: `Badge` text accompanies semantic colors.
- All icon-only buttons get `aria-label`; Nemo components expose refs and ARIA wiring, wrappers must
  preserve them.
- Focus stays visible; `Drawer`/`Modal` focus trap and `Esc` behavior come from the library — do not
  reimplement dialogs.
- Form errors are linked to inputs through `FormField` (`htmlFor` + `error`), and the first invalid
  field receives focus on submit.
- Minimum contrast: use `neutral[700]` for secondary text on white, `neutral[900]` for body.
- Tables: pass `caption` or an accessible heading; sorting is keyboard-reachable via header buttons.

## 5. Figma reference — NOT INSPECTED

The reference is the "SmartHR — Free Figma UI Kit for HRM / Employee Management" community file
(`node-id=273-57897`). The URL cannot be fetched from this environment: DNS resolves to a blocked
address, and Figma requires an authenticated, JavaScript-rendered session — a plain fetch cannot
render the canvas even when reachable.

Therefore this document makes **no claims** about its sidebar width, colors, type ramp, card style or
frame inventory. To proceed, provide either:

1. Screenshots (PNG) of at least: dashboard, employee directory, employee profile, create/edit
   employee form, and one modal; plus
2. Exported frames or a design-token export (Figma variables JSON) if available; or
3. Explicit approval to use the layout system in §2 (built on verified Nemo tokens) as the baseline,
   with Figma used later for refinement.

Until then, Phase 3+ UI work builds on §2 and the Nemo tokens, and can be restyled cheaply because
styling is centralized in shell components and the theme layer.
