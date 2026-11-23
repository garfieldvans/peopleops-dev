# PeopleOps — UI Library Inventory (`@nemo-ui/ui` 0.1.0)

Method: `npm pack @nemo-ui/ui@0.1.0` and inspection of the shipped `dist/**/*.d.ts` declarations and
`README.md` on 2026-11-21. Everything below is taken from those files. No API is assumed.

## 1. Package facts

- ESM only (`"type": "module"`), `main`/`module`/`types` point at `dist/index.js` / `dist/index.d.ts`.
- Peer dependencies: `react ^19.0.0`, `react-dom ^19.0.0` (not bundled).
- Exports: `.` (JS + types) and `./index.css`.
- Stylesheet **must** be imported once in the entry: `import "@nemo-ui/ui/index.css";`
- Theming: `ThemeProvider` (`mode`, `theme`, `surface`, `as`), `useTheme()` → `{ theme, mode, setMode }`,
  plus `defaultTheme`, `darkTheme`, `palette`, `toCssVarMap`.
- `sideEffects` includes CSS, so the stylesheet survives tree-shaking.
- Public exports are 31 components plus foundations/theme. The `components/internal/` folder
  (Portal, useFloating, icons, ...) is **not** exported — do not import from it.

## 2. Component inventory (verified)

| Component | Verified props (summary) | Variants / notes |
| --- | --- | --- |
| `Button` | native button attrs, `variant`, `color`, `size`, `children` | `filled`/`outlined`/`text`; `primary`/`secondary`/`success`/`warning`/`error`; `sm`/`md`/`lg` |
| `Input` | native input attrs minus `size`/`color`, plus `label`, `error`, `warning`, `success`, `helperText`, `leftIcon`, `rightIcon`, `rightIconAction`, `prefix`, `suffix`, `fullWidth`, `clearable`, `onClear`, `floatingLabel`, `variant`, `size`, `status` | `filled`/`outlined`/`ghost`; `as="textarea"` adds `rows`, `maxLength`, `showCount` |
| `Select` | `options: {label,value,disabled?,description?}[]`, `value`, `onChange(value: string)`, `searchable`, `clearable`, `onQueryChange`, `placeholder`, `label`, `error`, `disabled`, `fullWidth`, `ref` | Single select. **`onChange` receives the value string, not an event** |
| `Combobox` | multi-select: `value: string[]`, `onChange(values: string[])`, `filter`, `loading`, `loadingText`, `onQueryChange`, `emptyText` | Multi-select only (no single mode) |
| `DatePicker` | `mode: "single" \| "range"`, `value: Date \| null` / `{start,end} \| null`, `onChange(date)`, `min`, `max`, `format` (`dd/mm/yyyy` \| `yyyy-mm-dd`), `weekStartsOn`, `name` (hidden input, `yyyy-mm-dd`) | Calendar + manual input; keyboard navigable |
| `FileUpload` | `accept`, `multiple`, `maxSize`, `maxFiles`, `value: File[]`, `onChange(files)`, `onReject(rejections)`, `getFileStatus`, `dropText`, `hint` | Drag & drop; client-side validation only |
| `Table` | `columns: {key,header,render?,align?,width?,sortable?,sortValue?}[]`, `data`, `rowKey`, `pagination: {page,pageSize,pageCount,total,onChange,size}`, `sort`/`defaultSort`/`onSortChange`, `selectable`, `selectedKeys`, `onSelectionChange`, `stickyHeader`, `maxHeight`, `striped`, `size`, `emptyText`, `caption` | Server mode when `pageCount` is provided (data not re-sliced); controlled sort |
| `Pagination` | `page`, `pageCount`, `onChange`, `siblingCount`, `size`, `ariaLabel` | Standalone; `Table` embeds its own |
| `Modal` | `open`, `onOpenChange`, `title`, `description`, `footer`, `size`, `closeOnOverlay`, `closeOnEsc` | Controlled; `sm`/`md`/`lg` |
| `Drawer` | `open`, `onOpenChange`, `title`, `footer`, `placement`, `size`, `closeOnOverlay`, `closeOnEsc` | Left/right/top/bottom; focus trap + scroll lock |
| `Menu` | `trigger`, `asChild`, `open`, `onOpenChange`, `placement`, `offset`, `ariaLabel`; `Menu.Item {label, icon, disabled, onSelect}`, `Menu.Divider` | Compound component (verified static members) |
| `Tabs` | `items: {value,label,content?,disabled?}[]`, `value`, `defaultValue`, `onChange`, `variant`, `size`, `ariaLabel` | `line`/`pill`; arrow-key navigation |
| `Badge` | `color`, `variant`, `size`, `children` | `filled`/`outlined`/`dot`; includes `neutral` |
| `Card` | `variant`, `padding`, `rounded`, `as`; plus **separate** `CardHeader {title, subtitle, action}`, `CardBody`, `CardFooter` | `elevated`/`outlined`/`filled`; not compound (`Card.Header` does not exist) |
| `FormField` | `label`, `htmlFor`, `required`, `error`, `helperText`, `layout`, `width`, `children` | `vertical`/`horizontal`; `sm`/`md`/`lg`/`full` |
| `Avatar` / `AvatarGroup` | `src`, `alt`, `name`, `size`, `shape`, `color`; group `max` | `xs`–`xl`; `circle`/`square` |
| `Alert` | `tone`, `title`, `children`, `icon`, `variant`, `closable`, `onClose`, `action`, `role` | `surface`/`filled`; `role="alert"`/`"status"` |
| `Toast` | `ToastProvider {placement, maxToasts, queue}`, `useToast()` → `show/success/info/warning/error/dismiss/dismissAll/toasts` | Requires provider |
| `Stack` | `direction`, `spacing`, `align`, `justify`, `wrap`, `divider`, `as` | Layout primitive |
| `Divider` | orientation | |
| `Typography` | `variant` (11), `color`, `as`, `align` | `h1`–`h6`, `body`, `bodySmall`, `caption`, `overline`, `button` |
| `Checkbox`, `Radio`/`RadioGroup`, `Switch` | controlled/uncontrolled; `Switch` adds `label`, `size`, `color`, `error`, `helperText` | Form controls |
| `Progress` | line/circle, `value`, indeterminate | |
| `Skeleton` / `Spinner` | text/circle/rect, animation variants / sizes | Loading states |
| `Tooltip`, `Popover` | placement, offsets, delays / auto-flip | |
| `ScrollToTop` | scroll threshold behavior | |
| `Progress`/`Spinner`/`Skeleton`/`Alert` | as above | |

## 3. Mapping to HRIS requirements

| Requirement | Use | Notes |
| --- | --- | --- |
| Buttons | `Button` | One `filled primary` per screen; destructive = `filled error` + confirm `Modal` |
| Inputs | `Input` | `error` + `helperText` driven by RHF errors |
| Textarea | `Input as="textarea"` | `showCount` for leave reason |
| Selects | `Select` (single), `Combobox` (multi) | Department, status, employee picker; async via `onQueryChange` |
| Typography | `Typography` | Page titles, section headings, captions |
| Tables | `Table` | Server pagination with `pageCount`; controlled `sort` |
| Dialogs | `Modal` | Create/edit short forms, confirmations |
| Side panels | `Drawer` | Employee quick view, approval detail, mobile navigation |
| Dropdowns | `Menu` | Row actions, user menu, notification menu |
| Tabs | `Tabs` | Employee profile, settings |
| Badges | `Badge` | Employment status, leave status, payroll status |
| Cards | `Card` + header/body/footer | Dashboard stats, form sections |
| Form controls | `FormField`, `Input`, `Select`, `DatePicker`, `Switch`, `Checkbox`, `Radio` | Structured forms |
| File uploads | `FileUpload` | Contracts, ID scans |
| Feedback | `Toast`, `Alert` | Mutation success/error, page-level errors |
| Loading | `Skeleton`, `Spinner`, `Progress` | Table skeleton rows, upload progress |
| Pagination | `Table` pagination (preferred), `Pagination` outside tables | |

## 4. Gaps — components PeopleOps must build

None of these exist in the package; they are app-level composition, not forks of library internals:

| Gap | Approach |
| --- | --- |
| App shell (sidebar, topbar, nav groups, collapse) | `app/app-shell.tsx` + `Drawer` for mobile; Nemo `Button`/`Tooltip`/`Avatar`/`Menu` inside |
| Breadcrumb / page header | `PageHeader` (title, description, actions, optional back link) |
| Data table wrapper | `DataTable` around `Table`: server pagination state, sort mapping, toolbar slot, error/empty states |
| Async single-select (employee picker, 10k rows) | `AsyncSelect` built on `Select` (`onQueryChange` + debounce); show a `Spinner` in the helper slot while loading |
| Department tree selector | Not provided. Phase 3: flat `Select` with indented labels; a tree component only if depth demands it |
| Form bridge | `FormField` + RHF `Controller` wrappers (`TextField`, `SelectField`, `DateField`) so `error` strings are wired consistently |
| Confirm dialog | `ConfirmDialog` on `Modal` (title, consequence text, destructive action, loading state) |
| Empty state | `EmptyState` (icon, title, description, action) for pages without a `Table` |
| Stat / KPI card | `StatCard` on `Card` (label, value, delta, optional sparkline later) |
| Timeline (employment history, approvals) | Small `Timeline` component, no library equivalent |
| Charts (dashboard) | Not provided. Decide per phase; a lightweight chart lib is a separate decision, not a UI-kit replacement |
| Icons | Package has internal icons that are **not exported**. App supplies icons as `ReactNode` props from a single icon set (candidate: `lucide-react`, pending approval) |
| Date range filter | `DatePicker mode="range"` (exists) — no new component |
| Toast host | Mount one `ToastProvider` in `app/providers.tsx` |

## 5. Integration conventions

1. `main.tsx`: `import "@nemo-ui/ui/index.css";` before app styles, then
   `ThemeProvider` → `ToastProvider` → `QueryClientProvider` → router.
2. Wrap every form control in `FormField` for label/error consistency; do not hand-roll labels.
3. `Select`/`Combobox`/`DatePicker` are value-based, not event-based: use RHF `Controller`
   (`field.onChange` receives the value directly).
4. Design values come from the theme tokens; app CSS/Tailwind must not hardcode hex colors that
   duplicate tokens.
5. `Table` stays presentational: fetching, pagination and sorting live in feature hooks.
6. Never fork or patch the library. If a component needs behavior it lacks, compose it in
   `apps/web/src/components/`.
7. Verify any new component's props against `node_modules/@nemo-ui/ui/dist/src/**/*.d.ts` before
   using it — this inventory reflects 0.1.0 only.
