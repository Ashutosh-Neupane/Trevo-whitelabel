# Trevo Whitelabel UX Plan

## Goal

Make the v16 Desk feel consistently Trevo, improve document forms and lists on desktop and mobile, and keep Frappe/ERPNext document behavior reliable. Prefer a few shared design rules and supported extension points over a second Desk implementation or edits to Frappe's installed source.

This is a plan, not authorization to merge the legacy branches or alter live document behavior. The active target is `trevo_v16/apps/trevo_whitelabel`; its current `hooks.py` loads `trevo_theme.bundle.css` and `trevo_desk.bundle.js`. Its `legacy_v15/` folder is explicitly excluded from those hooks.

### Audit — 2026-11-17 (measured against the running Docker site)

**Runtime baseline.** Docker `trevo-v16-bench-1` (image `frappe/erpnext:v16.55.0`: Frappe 16.56.0, ERPNext 16.55.0) bind-mounts `trevo_v16/apps/trevo_whitelabel`. Active hooks (`frappe.get_hooks`): `app_include_css` ends with `trevo_theme.bundle.css`, `app_include_js` ends with `trevo_desk.bundle.js`. Nothing from `legacy_v15/` or the sibling `trevo_whitelabel` checkout is loaded.

**Status of the shadcn-style CSS slice.** Before this audit it was source-only: the served bundle (`HGEBC74L`) contained none of the new tokens. It has since been built through `bench build --app trevo_whitelabel` and is served (fingerprint changes each build; check `sites/assets/assets.json`). Each item below is marked *verified* only where a headless-Chrome check measured it on the served bundle.

Findings and corrections:

1. **Form layout vanished after submit — root cause confirmed, fixed, verified.** v16 `form.js` (refresh) puts exactly one of `editable-form` / `submitted-form` / `cancelled-form` on `.page-container` by docstatus. Every Trevo form rule was scoped to `.editable-form`, so submitted Sales Orders/Invoices fell back to Frappe's 900px centred layout with no card. Scope is now `.page-container:is(.editable-form, .submitted-form, .cancelled-form)`. Verified on SAL-ORD-2026-00001 (docstatus 1).
2. **`--page-max-width: 100%` does reach v16 section heads/bodies** (`desk/form.scss`: `body:not(.full-width) .section-body { max-width: var(--page-max-width) }`) and the form footer. Verified: section content spans the card at 390/820/1440 with no horizontal overflow (document `scrollWidth` = viewport in all six width/theme combinations). This mirrors v16's own "Toggle Full Width" (`body.full-width`).
3. **Side effect corrected: child-row editor.** `.grid-row-open .form-in-grid` (fixed, 80% wide) sits inside the page container and is capped by the same token, so it would have grown to ~1150px. It is reset to 900px. Verified widths: 312 / 656 / 900px.
4. **Focus ring removed from secondary buttons — corrected.** `.btn.btn-default { box-shadow: none }` had the same specificity as Bootstrap's `.btn-light:focus` ring (Frappe extends `.btn-light`) and loaded later. Removed; added an explicit `:focus-visible` ring. Hover is wrapped in `@media (hover: hover)` like Frappe's own mixin.
5. **Weak focus indicators — corrected, verified.** `--focus-outline-default` (used by `es-button` and breadcrumbs) now uses the solid brand fill instead of the 28% tint (~1.4:1 on white). Field focus used Bootstrap's compiled `#7c7c7c40` ring that no token reaches; `.form-control:focus` now uses `--focus-default`. More specific Frappe rules (grid editable row, datatable, `.has-error`) still win; mandatory-error borders verified intact in the row editor.
6. **Comments/activity misaligned with the card — corrected, verified.** The footer is a sibling of `.layout-main-section`; it now indents by `--trevo-form-gutter` + border + `--padding-md`. Card content and comment box share edges at every width (e.g. 321→1400px at 1440).
7. **Striped tab bar — corrected, verified visually.** v16 paints each `.nav-link` with `--card-bg`; the muted strip showed between tabs. The strip now uses the card surface with a bottom divider.
8. **Global control rules reviewed.** `.btn` radius/transition, `.btn-default` outline look and `.form-control` radius apply Desk-wide by design. Dialogs (Frappe `Dialog`), the row editor and the Sales Order list were checked in light/dark at all three widths; no layout change, primary actions keep the brand fill.

**Sales Order / Sales Invoice behaviour — diagnosed without changing records.**

- *Connections tab:* renders all 19 link groups with Trevo assets on and blocked; it shows no counts because no linked documents exist. Data, not CSS.
- *"Who changed what":* the Activity timeline renders (7 entries) below Comments. The right side panel (assignments, tags, created/modified by) is hidden by default by Trevo Settings; the header toggle or *Open the form side panel by default* brings it back. Not a rendering bug.
- *"After the order is created, the invoice does not work":* SO line `adsf` has rate 0 and no Item Price exists, so a mapped Sales Invoice totals Rs 0. In a rolled-back transaction the mapped invoice inserted and submitted without error, while a mapped Delivery Note failed with `NegativeStockError` (no stock of `adsf` in *Stores - DC*). Rollback confirmed (0 SI, 0 DN, 0 GL/SLE rows, SO `modified` unchanged). Both are data/setup causes. The visible regression after submit was finding 1.
- *Uncertain:* two `Page accounts/user-profile not found` errors were logged at 12:20:54. They are `getpage` calls for non-existent routes and most likely came from automated route scans during this work; not reproduced from the UI.

**Not yet verified:** cancelled and amended documents, permission-limited users, a custom DocType, RTL, 200% zoom, the `/signin` page against the new tokens, workspaces. The sibling-repository branch notes below were not re-checked in this audit.

## Branch comparison

The sibling `trevo_whitelabel` Git repository is on `rebrand-form-js-fixes` (`fc0baed`) with local edits in its working tree. It has several historical UI branches. These are useful design and debugging references, but they are not the active v16 app and should not be merged wholesale.

| Branch | Useful history | Plan for it |
| --- | --- | --- |
| `main` / `trevoDesign-concepts` | Initial Leaf Green brand and broad Trevo visual direction. | Keep the brand direction; treat its implementation as a v15-era baseline. |
| `feat/trevo-ui-stabilization` | Broad styling pass and compiled production assets. | Reuse visual ideas only; avoid copying generated bundles as source. |
| `trevo-whitelabel-ui-fix` | Emerald rebrand, chart changes, and updated bundles. | Review tokens/components selectively; rebuild assets from source. |
| `trevo-whitelabel-responsive-formbuilder` | Fix for incompatible live section/column class replacements. | Keep as a warning: the renderer has internal contracts and replacing its classes can break field rendering. |
| `trevo-ui-experiments` | Responsive Form Studio with Add Fields and Structure panels, inspired by Forms Pro. | Reuse interaction ideas only after checking a supported v16 integration route; the centered narrow canvas is not the requested live-record layout. |
| `white_label_before_last` / `rebrand-form-js-fixes` | Form Studio, grid-row styling, and desk/form layout fixes. The current checkout has additional uncommitted edits. | Preserve the checkout; inspect changes before any transplant. Do not copy its live renderer patches into v16 by default. |
| `white_label_feature` | Custom Desk navigation, dashboard APIs, routes, and sidebar work. | Evaluate features individually. Do not replace native v16 navigation or document sidebars without a specific proven need. |

The branch histories include generated `dist` output and Python bytecode. Neither should be treated as canonical source. The sibling repo's README also describes older hooks and a source-copy patch flow that do not match the active v16 `hooks.py`; update documentation only after the actual v16 behavior is verified.

## Frappe v16 integration boundary

Frappe v16 loads its form view, document form, controls, lists, and other Desk pieces as framework assets. The v16 `formview.js` fetches the selected document and passes it to the form view; `form.js` owns save, submit, callback, and refresh flows. Trevo should keep those flows intact and make visual changes through scoped CSS, desk-wide assets, and DocType-specific scripts when behavior is truly needed.

Supported surfaces to prefer:

- `app_include_css` / `app_include_js` for small, shared theme behavior.
- `doctype_js` / `doctype_list_js` for a focused DocType interaction or list improvement.
- Frappe's normal DocType metadata, Customize Form, Property Setters, and Custom Fields for field visibility and layout.
- Frappe hooks and document events for server behavior; no global save interception for cosmetic work.

Do not copy old Vue components over Frappe source, replace `Section`/`Column` constructors, add global CSS that forces visibility, or duplicate the document save/refresh lifecycle. If a future Trevo Form Studio needs to change structure editing, first prove the supported v16 extension surface and implement it as an isolated page/feature rather than silently modifying core assets.

References: [Frappe v16 hooks](https://raw.githubusercontent.com/frappe/frappe/version-16/frappe/hooks.py), [v16 FormView](https://github.com/frappe/frappe/blob/version-16/frappe/public/js/frappe/views/formview.js), [v16 document form and save lifecycle](https://github.com/frappe/frappe/blob/version-16/frappe/public/js/frappe/form/form.js), [v16 Section renderer](https://github.com/frappe/frappe/blob/version-16/frappe/public/js/frappe/form/section.js), and [Frappe hooks documentation](https://docs.frappe.io/framework/user/en/python-api/hooks).

## Staged plan

### 0. Confirm the running v16 baseline

- Confirm the exact app checkout, Frappe/ERPNext commit, site, asset bundle versions, and installed apps used by Docker.
- Capture representative screens and browser errors for a new Sales Order, saved Sales Order, submitted Sales Invoice, a custom DocType, a child-table editor, and a list.
- Trace one new document through Save → route/name assignment → form refresh. Record whether the reported issue is missing fields, failed persistence, stale values, a permission/metadata issue, or a rendering issue before changing behavior.
- Compare the live asset manifest and hook-loaded files with the v16 source. Keep generated `dist` changes out of source review unless the build explicitly requires committed assets.

**Done when:** there is a reproducible baseline and each defect is assigned to data/permission, DocType metadata, Frappe lifecycle, or Trevo presentation.

### 1. Make record forms usable and distinctly Trevo

- Build on Frappe's native form structure and existing card treatment; make the main form use the available content width rather than a narrow centered column.
- Use one responsive spacing system: comfortable gutters on desktop/tablet, edge-to-edge card on phones, no horizontal overflow, and readable field/control widths.
- Keep primary actions, workflow/status, breadcrumbs, tabs, sections, child tables, comments, and activity legible and consistently spaced. Retain their native placement and behavior.
- Make the right-side panel optional without hiding or replacing document fields or native page controls. Ensure the open/closed setting works for all DocTypes and at phone widths.
- Scope styles to ordinary record forms. Do not style dialogs, quick-entry forms, child-row editors, or print views as full record cards.
- Check light and dark themes; use Frappe tokens where possible, Trevo tokens where needed, and visible keyboard focus states.

**Done when:** Sales Order and Sales Invoice show all metadata-defined fields before and after save/submit, all values persist, child tables remain editable, and layout is usable at narrow/mobile/tablet/desktop widths.

### 2. Standardize shared Trevo controls

- Define a compact set of tokens for brand colors, surfaces, borders, radii, spacing, typography, focus rings, and semantic states.
- Apply consistent hierarchy to primary/secondary/destructive buttons, input/select/date controls, tabs, badges, links, dialogs, and empty/loading/error states.
- Preserve framework-provided disabled, read-only, validation, workflow, and permission states. Avoid broad selector overrides that flatten state colors or force hidden elements visible.
- Check contrast in light and dark themes and honor reduced motion.

**Done when:** one control looks and behaves consistently in forms, lists, dialogs, and settings without a competing legacy CSS system.

### 3. Improve list and workspace scanning

- After the form baseline is stable, tune list row height, primary/secondary text, status pills, responsive columns, filters, bulk actions, and empty states.
- Improve workspace number cards, charts, and shortcuts with shared tokens and clear hierarchy, while preserving native navigation and permissions.
- Add per-DocType list scripts only where a concrete workflow needs one; avoid global list rewrites.

**Done when:** common sales and accounting lists remain scannable at phone and desktop widths and users can identify status/actions without relying on color alone.

### 4. Reassess Form Studio and DocType layout editing

- First determine whether v16's built-in Customize Form / DocType Builder already covers the needed Doctype layout changes.
- Audit the existing Vue builder for save permissions, field/section/column data integrity, keyboard behavior, touch behavior, accessibility, and narrow-screen layout.
- If users need a richer editor than native tools provide, prototype a distinct Trevo Form Studio route with an explicit save/preview flow, then validate its supported integration with the pinned v16 release.
- Keep the live record form and the form-layout editor as separate experiences; a builder canvas should not dictate that sales forms become a narrow centered experience.

**Done when:** builders can add/reorder fields and sections without losing unrelated DocType data, and resulting forms render through Frappe's supported metadata/layout system.

### 5. Finish brand details after core workflows

- Review headings/fonts and self-host any font only after confirming license, loading performance, and fallback behavior.
- Add Trevo print/letterhead and email templates as separate deliverables, since desk CSS does not style generated documents or all email clients.
- Review app switcher, help/support links, onboarding labels, and remaining upstream credits with licensing constraints in mind.

## Validation matrix for implementation

For each phase, validate a standard DocType (Sales Order), a transaction DocType (Sales Invoice), a custom DocType, a child table, a dialog/quick-entry form, and list view. Check new, saved, submitted, read-only, validation-error, and permission-limited states at approximately 390px, 820px, and 1440px in light and dark themes. Confirm no JavaScript errors, no duplicate/hidden fields, no horizontal overflow, and no regression in save, submit, route, or refresh behavior.

## Recommended order

Start with Phase 0, then implement Phase 1 as the first visual milestone. Phase 2 should supply shared styles while Phase 1 is refined. Only then move to list/workspace polish and decide whether Form Studio needs a new v16 implementation. Keep each phase small enough to compare against its baseline and roll back without touching document data.

# Detailed implementation blueprint

## Shadcn-inspired direction

Use shadcn as a visual and design-token reference, not as a library to install into Desk. The useful ideas are semantic CSS variables, neutral layered surfaces, a small radius scale, clear primary/secondary/outline/destructive action variants, consistent field treatment, and visible focus rings. Trevo keeps the emerald brand and Frappe's native components, routes, controls, permissions, and lifecycle. Do not add React, Tailwind, Radix, or shadcn dependencies to the Frappe Desk to reproduce its appearance.

Apply the reference through these translations:

- `background` becomes the Trevo page canvas; `card` becomes the form/workspace surface; `muted` becomes a quiet tab/secondary surface.
- `foreground` and `muted-foreground` become readable content and secondary text colors in both themes.
- `border`, `input`, and `ring` become Frappe-compatible boundaries, control outlines, and keyboard focus feedback.
- `primary` becomes Trevo emerald with a foreground color that passes contrast; `secondary` and `outline` stay neutral.
- `destructive` remains a semantic danger color; success, warning, and information retain their own semantics.
- A shared radius scale keeps buttons, fields, menus, cards, and dialogs related without making every component a pill.
- Buttons get a consistent size/weight/variant system, while native Frappe classes continue to decide which action is primary, disabled, or destructive.

This direction follows shadcn's own guidance to use CSS variables and semantic theme tokens, including foreground pairs, border/input/ring, sidebar, and radius tokens. Trevo adapts those ideas to Frappe's existing CSS and espresso controls rather than importing the React component implementation. Reference: [shadcn theming](https://ui.shadcn.com/docs/theming), [shadcn buttons](https://ui.shadcn.com/docs/components/aria/button).

### Implemented slice in the active v16 theme (built and served; see the audit for what was measured)

- Semantic tokens: `--trevo-canvas`, `--trevo-surface`, `--trevo-surface-muted`, `--trevo-border`, `--trevo-foreground`, `--trevo-muted`, `--trevo-radius-sm/md/lg`, with dark values.
- Record forms in all document states (`editable-form`, `submitted-form`, `cancelled-form`): canvas + card, `--page-max-width: 100%` (row editor kept at 900px), shared `--trevo-form-gutter` for card and footer, edge-to-edge card at ≤767px.
- Controls: compact radius on `.btn` and `.form-control`; neutral outline `.btn-default` with a visible focus ring; brand focus on fields and on `es-button` outlines; reduced-motion honoured.
- Typography (trevocloud.com): body `"Helvetica Neue", Helvetica` with Frappe's bundled Inter as fallback; headings (page title, section heads, dialog and widget titles) in self-hosted Anek Latin (OFL, `public/fonts/anek-latin/`). Type scale one step up: 12.5 / 14 / 15 / 17px.
- Currency symbols (U+20A0–20C0) are served from Frappe's Inter via a `unicode-range` face: Helvetica Neue draws NPR's stored symbol `₨` (U+20A8) as one cramped glyph, which made every amount look broken.
- Form fields: 36px, card surface with a 1px border; read-only fields use the same surface and border without shadow. Labels 14px muted, values 15px. Section padding 20px; tabular numbers for amounts.
- Comments/Activity sit on the canvas (`--bg-color` redefined inside `.form-footer`).
- One background system: canvas behind every list, report view, query report, tree, workspace and form; content in bordered cards with the same radius as the form card. Filter bars (`.page-form`) use the form field style at 32px.
- Search: `<mark>` uses brand tint + brand ink. Bootstrap's yellow inherited the text colour, which was white-on-yellow in dark mode.
- Green-tinted neutrals: the gray scale (which drives Frappe's surface/ink/outline tokens) is emerald-tinted instead of slate. Canvas `#F5F9F7` light / `#0B1310` dark. All text pairs ≥4.5:1.
- One page background: Frappe's `--bg-color` (white `--surface-base`) now points at the canvas, so every Desk page, header and sidebar shares it; `--modal-bg` and `--popover-bg` (which default to `--bg-color`) are pinned to the white card surface. `/signin` uses the same palette.
- Screen use: form gutter 16px, section padding 12px (fields ~28px from the card edge, was ~60px). Lists, report view and query reports use a filter toolbar on the canvas with a single results card.
- Not done yet: dropdown/popover review, destructive-button review, kanban/calendar views, the blue empty-chart illustration on dashboards (Frappe artwork).

## Design principles for all phases

1. **Native document behavior remains the source of truth.** Frappe owns metadata, permissions, calculations, save, submit, cancel, routing, reload, and form refresh. Trevo changes appearance and adds narrow, reviewable behaviors only.
2. **Make the useful content visible first.** The form header identifies the record and its status; the primary action is easy to find; fields use the available content width; secondary actions are discoverable without crowding the form.
3. **Use responsive space instead of a fixed desktop mockup.** A desktop form can use a broad content lane. Tablet and phone layouts should reduce columns and gutters naturally. No fixed width may make the record or its footer horizontally scroll.
4. **One design system, not per-page decoration.** Forms, lists, dialogs, workspaces, login, and settings share semantic colors, type scale, spacing, controls, borders, focus treatment, and status styles.
5. **Brand through a restrained signature.** Trevo emerald marks primary actions, active navigation, links, and focus. Neutral surfaces carry most of the interface. Status colors remain semantic and distinguishable from the brand color.
6. **Prefer tokens and component classes over element selectors.** Scope exceptions to known Frappe component roots and keep specificity low enough that disabled, hidden, error, and theme states continue working.
7. **Do not make appearance depend on text replacement.** Labels, translations, framework messages, and accessibility names should remain owned by Frappe or the translating app.
8. **Keep density deliberate.** Comfortable is the default for forms and touch. Compact density may be offered as a preference later, but it must not reduce touch targets or remove information.
9. **All states are designed.** Empty, loading, permission-limited, validation-error, read-only, disabled, submitted, cancelled, and failed-save states receive the same care as the default state.
10. **Every visual change has a narrow ownership boundary.** A form rule should not style a modal form; a grid-row rule should not reflow the whole document; website styles should not leak into Desk.

## CSS source architecture proposal

The active theme is currently a single `trevo_theme.bundle.scss`. Keep that as the asset entry point and gradually split source by responsibility only when a phase needs it. The target organization is:

- `public/css/trevo_theme.bundle.scss`: imports partials in a documented, stable order.
- `public/css/trevo/_tokens.scss`: brand scale, semantic colors, surfaces, outlines, spacing, type, radii, shadows, motion, breakpoints, and z-index map.
- `public/css/trevo/_base.scss`: font stack, body defaults, text selection, focus visibility, reduced-motion handling, and minimal reset.
- `public/css/trevo/_desk-shell.scss`: page shell, header, breadcrumb, workspace, sidebar, and responsive shell behavior.
- `public/css/trevo/_controls.scss`: buttons, inputs, selects, checkboxes, date/time, links, pills, and icons.
- `public/css/trevo/_forms.scss`: record header, tabs, sections, fields, child tables, form footer, comments, and activity.
- `public/css/trevo/_lists.scss`: list toolbar, filters, rows, badges, pagination, and empty/loading states.
- `public/css/trevo/_overlays.scss`: dialogs, dropdowns, popovers, tooltips, and autocomplete.
- `public/css/trevo/_workspace.scss`: workspace shortcuts, charts, and number cards.
- `public/css/trevo/_website.scss`: public login and website-specific Trevo rules only if separate bundling is needed.
- `public/css/trevo/_utilities.scss`: a deliberately small set of Trevo-owned utility classes; never a dumping ground for one-off fixes.

Create only the partials required by a phase. The list above is the intended ownership map, not a requirement to split every selector immediately. Keep import order explicit: tokens, base, shell, reusable controls, page components, overlays, utilities. Do not import the old `legacy_v15` styles into the active bundle.

## Token specification

Use Frappe's own tokens when a component already reads them. Trevo tokens should be semantic aliases so dark mode can change the values without rewriting component selectors.

| Token family | Examples to define | Use |
| --- | --- | --- |
| Brand | `--trevo-50` through `--trevo-900`, `--trevo-primary`, `--trevo-primary-hover`, `--trevo-primary-pressed`, `--trevo-on-primary` | Primary buttons, active navigation, links, selected controls. |
| Text | `--trevo-text`, `--trevo-text-muted`, `--trevo-text-subtle`, `--trevo-text-disabled`, `--trevo-text-inverse` | Headings, labels, secondary text, disabled controls. |
| Surface | `--trevo-canvas`, `--trevo-surface`, `--trevo-surface-raised`, `--trevo-surface-sunken`, `--trevo-overlay` | Page, card, inset area, modal, menu. |
| Outline | `--trevo-border`, `--trevo-border-strong`, `--trevo-divider`, `--trevo-focus-ring` | Control boundaries and keyboard focus. |
| Status | `--trevo-success`, `--trevo-warning`, `--trevo-danger`, `--trevo-info` and matching soft surfaces | Submitted, overdue, errors, notices, and information. |
| Space | `--trevo-space-1` through `--trevo-space-8` | Consistent component gaps and page gutters. |
| Shape | `--trevo-radius-control`, `--trevo-radius-card`, `--trevo-radius-dialog`, `--trevo-radius-pill` | Controls and surfaces. |
| Elevation | `--trevo-shadow-card`, `--trevo-shadow-menu`, `--trevo-shadow-dialog` | Only where hierarchy needs elevation. |
| Type | `--trevo-font-sans`, `--trevo-font-mono`, `--trevo-text-xs` through `--trevo-text-xl`, `--trevo-line-height` | Shared readable type scale. |
| Motion | `--trevo-motion-fast`, `--trevo-motion-normal`, `--trevo-ease-standard` | Small transitions; disable or reduce when requested. |

For each token, specify a light value, a dark value, a semantic purpose, and a contrast check. Avoid introducing opaque colors directly into component rules. Avoid naming tokens after a single component. Keep Trevo's green for brand actions; do not map every Frappe state token to green.

## CSS implementation rules

- Keep selectors under a clear root such as `.page-container:is(.editable-form, .submitted-form, .cancelled-form)`, `.list-view`, or a Trevo-owned root class. Never scope record-form rules to `.editable-form` alone: v16 swaps that class by docstatus.
- Avoid global `div`, `span`, `button`, `input`, `.ellipsis`, `.form-control`, and `.hide` overrides unless the rule is a true baseline and has been reviewed against all Desk pages.
- Never use `display: ... !important` to reveal fields, controls, sidebars, or children. Frappe toggles visibility using state classes and JavaScript; overriding those states can cause hidden fields or doubled controls.
- Do not style by matching translated text, record names, route fragments, or generated asset hashes.
- Do not insert `position: fixed`, high z-index, or overflow clipping without a named overlay/layout requirement and a collision check.
- Do not set fixed heights on forms, columns, sections, controls, grids, or footer regions that need to grow with content.
- Prefer `min-width: 0`, flexible layout, `max-width: 100%`, and intrinsic sizing to stop long values and child tables from forcing overflow.
- Scope form card rules so dialog forms, quick-entry forms, grid row editors, and print output retain their native layouts.
- Preserve Frappe's error, focus, disabled, read-only, mandatory, hidden, workflow, and permission states. Override presentation only after recording the native state class or attribute.
- Use `:focus-visible` behavior or the framework focus token; never remove the outline without an equally clear replacement.
- Keep motion short and nonessential. Honor `prefers-reduced-motion` for custom transitions.
- Use logical properties (`margin-inline`, `padding-inline`, `inset-inline`) where practical so RTL layout does not require duplicate declarations.
- Add a comment when a selector depends on a Frappe DOM contract, naming the component and the v16 source/version that was checked.
- When upstream changes the markup, remove or revise stale selectors instead of stacking another override.
- Keep style changes in source SCSS; rebuild through the normal app build when the environment is available. Do not hand-edit fingerprinted output files.

## Form and DocType work breakdown

### Record entry and reading

- Establish a stable document header hierarchy: breadcrumb, DocType/record title, status/workflow, and actions.
- Let title width shrink without pushing actions off-screen; allow action groups to wrap or move into native overflow menus at narrow widths.
- Maintain visible context when scrolling long forms, without duplicating the same title or actions in a way that conflicts with Frappe's native header.
- Use page-level gutters that adapt to the available main section width, not a fixed pixel center column.
- Keep the form card as the visual container where appropriate; use internal section spacing to create hierarchy instead of nesting many decorative cards.
- Distinguish section titles from field labels using weight, size, and spacing, not color alone.
- Make field help, descriptions, mandatory marks, and error messages close to the field they describe.
- Keep labels readable at 100% zoom and values readable when long, numeric, translated, or multiline.
- Preserve native section/column metadata and do not infer a two-column layout from CSS alone.
- Prefer the form designer's configured columns, with a responsive collapse to one column when the available width is insufficient.
- Retain all configured fields even when they are conditionally hidden by Frappe metadata or business rules.
- Preserve tab labels and active indicators; allow many tabs to scroll or wrap without clipping their focus ring.
- Make keyboard order follow the visible form order and keep focus visible after tab changes.
- Keep comments and activity visually connected to the document and aligned with the form content lane.
- Avoid a constrained content width that makes sales item tables, accounting fields, or comments feel compressed on wide screens.
- Avoid full bleed on larger viewports if it makes text fields excessively long; use readable control widths inside a broad form lane.

### Sales Order-specific review

- Confirm customer, transaction date, company, currency, pricing, and delivery fields remain visible according to metadata and permission.
- Confirm item grid columns remain usable, including item code, quantity, rate, amount, warehouse, and any configured custom columns.
- Confirm adding/removing rows, opening a row editor, selecting a linked item, and recalculating totals still use Frappe's native behavior.
- Confirm taxes, totals, discount, terms, and address sections do not become hidden under overflow clipping.
- Confirm the header status and primary actions remain clear for draft, submitted, cancelled, and amended records.
- Confirm Create Invoice / delivery-related actions remain present when ERPNext state and permissions allow them.
- Confirm after first save the route and document name update correctly and the values remain displayed after refresh.
- Confirm reload of a saved order fetches the same values, not merely the unsaved client model.
- Confirm list navigation back to the order does not produce a blank or stale form.

### Sales Invoice-specific review

- Confirm customer, posting date, company, currency, due date, and payment/accounting values remain visible as configured.
- Confirm item grid, tax rows, totals, payments, outstanding amount, and references remain accessible.
- Confirm draft, submitted, cancelled, return/credit-note, and read-only states have distinct but familiar status treatment.
- Confirm Save, Submit, Cancel, Amend, and print/email actions remain governed by native permissions and workflow.
- Confirm after save and submit the form refreshes status, actions, totals, and document name from the server response.
- Confirm no styling rule hides a section simply because it is collapsed or not currently active.

### Custom DocType-specific review

- Use at least one custom DocType with a long title, several tabs, read-only fields, mandatory fields, and a child table.
- Check custom field types that are not common in Sales forms: Attach, Image, HTML, Table MultiSelect, Code, Signature, and geolocation where present.
- Confirm Customize Form property changes affect the rendered form after reload without needing a theme code edit.
- Confirm role permission differences yield clear read-only/hidden behavior rather than blank-looking gaps.
- Confirm field dependencies and display conditions work after changing their controlling fields.
- Confirm a new custom DocType can use Frappe's standard form builder metadata without requiring a Trevo-specific renderer.

## Form Studio decision plan

The existing `public/custom_form_builder` code in the sibling repository is a separate Vue experience historically copied into Frappe source by a script. The active v16 app does not load that code. Treat these as three separate decisions:

1. **Do users need a different way to create custom DocTypes?** If Customize Form and DocType Builder already solve the need, improve guidance and styling around those native screens.
2. **Do users need a better arrangement editor for existing DocTypes?** Inspect the exact v16 builder API and page lifecycle. Do not copy old classes into a compiled bundle.
3. **Is the current Vue Form Studio worth maintaining?** Review save/read-only permissions, the shape of layout JSON, version compatibility, migrations, error handling, and touch accessibility. Retire or port only after an isolated proof works.

If retained as a Trevo page, requirements are:

- Identify whether it edits DocType metadata or only a presentation layout; explain the scope to administrators.
- Show the target DocType, unsaved state, last saved state, and read-only/permission state.
- Keep the property sidebar usable at mobile widths without permanently consuming the canvas.
- Use a fluid work area; avoid a narrow preview card that repeats the same centered form constraint users rejected.
- Allow preview at phone, tablet, and desktop widths without changing the source DocType unintentionally.
- Keep drag/drop optional; provide keyboard actions and explicit move controls.
- Preserve fields not represented by the editor and warn before destructive section/column changes.
- Validate data before save and display actionable server errors without silently dropping changes.
- Save through an explicit supported API with permission checks, version/conflict handling, and a clear success confirmation.
- Make reset/revert actions explicit and undoable where possible.
- Keep all fields accessible by keyboard and screen reader, including drag handles and selection state.
- Add a compatibility note for each Frappe v16 release whose internal metadata/layout shape is supported.

## Trevo interaction and button system

- **Primary action:** one strongest action per context, emerald fill, sufficient contrast, clear verb, disabled/busy behavior visible.
- **Secondary action:** neutral outline or quiet surface; use for common supporting actions without competing with primary action.
- **Tertiary action:** text/quiet button for low-risk navigation and optional tools.
- **Destructive action:** semantic red treatment with confirmation when destructive; never style it as Trevo green.
- **Icon action:** native tooltip/accessible label, minimum comfortable hit area, visible focus, and no icon-only ambiguity.
- **Split action:** keep the main action clickable separately from its menu; label and keyboard behavior must be obvious.
- **Workflow action:** respect state and permission; don't apply the same primary treatment to every available workflow transition.
- **Busy action:** communicate progress and prevent duplicate submits; restore state when a request fails.
- **Disabled action:** readable enough to understand context but clearly unavailable; do not imply a permission bypass.
- **Focus behavior:** strong focus ring that works on emerald, white, gray, and dark surfaces.
- **Button spacing:** align buttons by baseline and use consistent gaps; avoid per-button margin nudges.
- **Button sizing:** standard, small, and touch-friendly sizes share a common height and padding scale.
- **Button text:** preserve translated labels; do not truncate primary actions without an accessible full label.
- **Keyboard:** tab, enter, space, escape, and arrow behavior remains the native browser/Frappe behavior where applicable.
- **Motion:** hover/press transitions should not shift nearby layout or cause visual jitter.

## Lists, workspace, and navigation plan

### Lists

- Establish list density, row height, selected/hover/focus states, and an obvious subject hierarchy.
- Keep status labels textual and semantic; color is supporting information only.
- Ensure list actions remain reachable when the viewport narrows, including bulk actions and filters.
- Keep filter chips and active filter state visible; make clear/remove actions keyboard accessible.
- Preserve saved filters, sort order, selection, pagination, and route semantics.
- Make empty, loading, permission-limited, no-results, and error states distinct.
- Keep long names, links, and values readable with deliberate wrapping or an accessible truncation strategy.
- Preserve list settings and column selection provided by Frappe.
- Avoid building a replacement list implementation for cosmetic improvements.

### Workspaces and dashboard

- Use consistent card surfaces for number cards, shortcuts, and charts without turning every section into a floating box.
- Align labels, values, icons, and chart titles on a clear spacing grid.
- Keep chart labels and legends visible in light/dark and on mobile.
- Avoid hardcoded chart dimensions that clip labels on smaller screens.
- Preserve native workspace links and role-based visibility.
- Keep dashboard loading, unavailable-data, empty, and error states usable.
- Verify currency/date/number formats follow the active user and site locale.

### Navigation and sidebars

- Preserve Frappe routes and keyboard behavior.
- Keep the active workspace visually obvious but restrained.
- Make collapse/expand state predictable and not dependent on mutation observers if a supported event/state exists.
- On mobile, use a clear drawer or overlay with close action and focus behavior; do not consume half the viewport with a fixed desktop rail.
- Keep custom navigation optional and ensure there is always a route back to native Desk.
- Do not hide Frappe's sidebar to replace it with data that is guessed from undocumented object properties.

## Login and public pages

- Keep sign-in, password reset, two-factor handoff, and account recovery behavior unchanged while applying the same Trevo tokens.
- Verify the “More ways to sign in” secondary action remains visually secondary and keyboard accessible.
- Use a self-hosted brand font only after confirming licensing and local fallback; avoid blocking first paint on font delivery.
- Scope public-page selectors to the login/page root; keep website typography independent of desk control density.
- Check error messages, password visibility, loading, disabled submit, and query-parameter redirects.
- Ensure reduced motion, small-height phones, and zoomed text do not hide the submit or recovery controls.

## Dark theme and accessibility requirements

- Define every semantic token in both light and dark themes; avoid relying on browser inversion.
- Check text contrast for normal text and large text, controls, focus rings, badges, borders, placeholders, and disabled states.
- Keep status semantics clear through label/icon/shape in addition to color.
- Preserve text zoom to 200% without loss of content or function.
- Maintain keyboard access to menus, tabs, dialogs, form sections, grid rows, and sidebars.
- Keep visible focus inside scroll containers and near the active control.
- Ensure dialogs trap focus correctly through Frappe; CSS must not cover the close action.
- Ensure error summaries and field error messages are not color-only.
- Use adequate hit areas for phone/touch use while keeping mouse layouts compact.
- Respect `prefers-reduced-motion` and avoid flashing/pulsing indicators for persistent state.
- Keep heading and label hierarchy meaningful for assistive technology; styling does not substitute for semantic markup.

## File-by-file change map for later implementation

| Active v16 file | Planned responsibility |
| --- | --- |
| `hooks.py` | Keep the small app include list; add page/DocType hooks only for a concrete supported feature. |
| `public/css/trevo_theme.bundle.scss` | Stable SCSS entry point and only the shared rules that still fit in one file. |
| `public/css/trevo/_tokens.scss` | Shared semantic Trevo tokens, if the source is split. |
| `public/css/trevo/_forms.scss` | Native record form presentation, scoped to ordinary form pages. |
| `public/css/trevo/_controls.scss` | Button and field-control treatment shared across Desk. |
| `public/css/trevo/_lists.scss` | List rows, filters, status, and responsive list layout. |
| `public/css/trevo/_overlays.scss` | Dialog, popover, menu, and autocomplete surfaces. |
| `public/js/trevo_desk.bundle.js` | Small shared behavior using Frappe public events/APIs; avoid observing/replacing core DOM where possible. |
| `public/js/doctype/sales_order.js` | Only if a confirmed Sales Order behavior defect requires a DocType-specific enhancement. |
| `public/js/doctype/sales_invoice.js` | Only if a confirmed Sales Invoice behavior defect requires a DocType-specific enhancement. |
| `legacy_v15/` | Historical reference only; never add it to active v16 hooks without a deliberate compatibility project. |
| `README.md` | Correct the v16 documentation to match active hooks, build, and supported customization approach. |
| `WHITELABEL_UX_PLAN.md` | The staged plan and its acceptance matrix. |

Do not create the DocType scripts in this map until a reproducible behavior gap exists. Appearance-only fixes belong in CSS.

## Baseline and implementation evidence

For each issue, record the page route, DocType, document state, user role, screen width, theme, and exact visible result. Keep a screenshot before and after, console output, and the responsible CSS selector or script hook. Distinguish these failure classes:

- **Data missing from the server response:** inspect permissions, field metadata, server-side fetch, and document state; CSS cannot fix it.
- **Field absent from metadata/layout:** inspect Customize Form, Property Setters, DocType JSON, dependencies, and role permissions.
- **Value not persisted:** inspect validation, save request/response, server errors, and controller behavior; visual changes are not a fix.
- **Value persisted but not rendered:** inspect native field control, refresh cycle, conditional display, client script, and computed visibility.
- **Value rendered but clipped:** inspect overflow/width/height and the precise form/section/grid ancestor.
- **Post-save route or refresh failure:** inspect Frappe's own route/save lifecycle and scripts attached to that DocType; do not replace the lifecycle.
- **Only sidebar metadata absent:** inspect Frappe sidebar feature/settings/permissions; do not confuse the right panel with document fields.

Do not report “all data is visible” from a screenshot of one record. Compare fetched document values with rendered controls and permissions for the current user. Do not create, edit, submit, cancel, or delete live business records as a styling check; use a safe test site or an explicitly approved test document.

## Rollout and review gates

- Keep each visual phase in a small commit or isolated patch with one reason for change.
- Record source files, build output expectations, and rollback instructions for every phase.
- Review the complete diff before applying it to a shared Docker site.
- Build the app assets in the intended v16 environment and clear only the relevant cache when the environment's workflow requires it.
- Verify the served asset manifest changes to the new bundle fingerprint; a source edit alone does not prove the site is using it.
- Re-open representative records after deployment and ensure the loaded asset path belongs to the Trevo app.
- Capture before/after screenshots at all listed viewport/theme combinations for changed components.
- Confirm core save, submit, cancel, reload, and route transitions on a disposable/non-production site.
- Revert a phase if it creates hidden fields, double-rendered controls, inaccessible actions, or data workflow regressions.
- Update this plan with measured findings and mark only verified acceptance items complete.

## Visual review matrix

Replaces the earlier 1,296-entry list (36 components × 3 widths × 2 themes × 6 states, with the same boilerplate sentence repeated). Run every row at 390, 820 and 1440px in light and dark, using representative long values. Only the states listed for a row apply to it. A row is ticked only after a check against the served bundle; record the date and bundle fingerprint.

Global pass criteria for every row: no horizontal page overflow, no duplicated or newly hidden fields, no JS errors, visible keyboard focus with ≥3:1 contrast, text contrast ≥4.5:1 (≥3:1 for large text), no action covered or clipped.

| Area | Components | States that matter | Specific check | Status |
| --- | --- | --- | --- | --- |
| Record form shell | Page header, title/image, breadcrumbs, tabs, section heads, card, footer | draft, submitted, cancelled; side panel open/closed | Same card in all three docstatus classes; tabs scroll at 390px without stripes; footer aligned to card content | Verified 2026-11-17 for draft (new SI) and submitted (SO), all widths/themes. Cancelled not checked. |
| Fields | Data/Link/Select/Date/Currency/Check, descriptions, errors | rest, focus, read-only, mandatory-error, disabled | Brand focus ring; read-only does not look editable; `.has-error` border wins over Trevo focus | Focus verified (forms, dialog). Read-only seen on submitted SO. Error borders seen in row editor. Disabled not checked. |
| Child tables | Grid, row editor, Add row / Download | rest, editing, many columns at 390px | Row editor stays 900px max and fixed; grid scrolls inside the card, not the page | Verified widths 312/656/900px; no overflow. |
| Actions | Primary, secondary (`btn-default`/`es-button`), destructive, icon buttons, split/Create menu | rest, hover (pointer only), focus-visible, active, disabled, busy | One primary per context; destructive stays red; focus visible on emerald and neutral | Primary and `es-button` focus verified; destructive seen red in row editor. Busy/disabled not checked. |
| Overlays | Dialogs, quick entry, dropdowns, link autocomplete, awesomebar | open, focus, validation-error, phone | Native width (575px desktop); match highlight readable in both themes | Dialog verified all widths/themes; awesomebar verified 1440/390 light and dark. Dropdowns/link autocomplete not checked. |
| Comments and activity | Comment box, timeline, New Email | empty, with entries | Visible below the form in every state; aligned with card | Verified (7 timeline entries) all widths/themes. |
| Right side panel | Assignments, attachments, tags, created/modified | default closed, toggled open, phone | Toggle works per DocType; nothing in the document body depends on it | Toggle verified in earlier session; recheck after next JS change. |
| Lists and reports | Toolbar, filters, rows, status pills, pagination; report view; query report | empty, loaded, filtered, phone | Filter and result cards align; row activity cell matches card in dark | Verified 2026-11-17: list 390/1440 light, dark; report view and query report 1440 light; Item list dark. |
| Workspaces | Onboarding, shortcuts, number cards, charts | loaded, empty, phone | All widgets share the card surface in both themes; progress in brand | Verified 2026-11-17 at 1440 light and dark. Phone not checked. |
| Navigation | Desk sidebar, dock, mobile drawer | active item, collapsed, phone | Active item in brand ink; drawer has a close action | Seen in screenshots; not formally checked. |
| Sign-in | `/signin`, `/login-classic` | error, loading, password visible, short phone | Submit and recovery visible on 390×640; redirect preserved | Not checked in this pass. |

Use `docstatus`-specific records that already exist, or new unsaved documents. Do not save, submit or cancel live records for a visual check.

## Round 2026-11-17 (b): white sheet, tables, sticky layers, stock-vs-Trevo review

- **One white sheet.** `--trevo-canvas` and `--trevo-surface` are both white (dark: `#0f1814`); hierarchy comes from hairline `--trevo-border`, not grey panels.
- **One table language.** List results, child grids (`.form-grid`) and report datatables (`.datatable` `--dt-*` tokens) share `--trevo-table-head` (header band), `--trevo-row-hover`, `--table-border-color: var(--trevo-border)` and radius-lg. Grid body rows keep row dividers only (column rules stay in the header). The grid footer strip is transparent (it was a dark block in dark mode).
- **Sticky layers.** v16 scrolls `.main-section` and `.result-container`, not the document. `trevo_desk.bundle.js` sets `body.trevo-scrolled` (page scroller) and `.trevo-scrolled` on the list scroller (passive, rAF-throttled). CSS gives the lowest stuck layer `--trevo-elevation`: the page head becomes frosted; on forms, the tab strip carries the shadow; on lists, the header band does. The mobile sticky paging bar gets a top hairline.
- **Neutral buttons unified.** In the page head, grid actions, list paging, modal footers and filter bars, Espresso's default/subtle `es-button` matches `.btn-default`: a white surface, hairline border and soft shadow. Green is reserved for primary actions.
- **Chart palette.** `frappe.utils.get_chart_palette` reads `--trevo-chart-1..10`; explicitly coloured charts (e.g. AR ageing) keep their colours.
- **Read-only cue restored.** Read-only fields use the `--trevo-table-head` fill with the same border.
- **Stock-vs-Trevo comparison** (Trevo assets blocked vs loaded; workspace, SO list/form, new SI, Accounts Receivable): there are no Trevo-only errors. The native chart `<path>` NaN warnings and the frappe-charts `removeChild` race appear in both.
- **Verification.** `verify.mjs` at 390/820/1440 × light/dark: no horizontal overflow, no page errors; row editor 312/656/900; dialog 374/575/575.
- **Open.** On ultra-wide screens, consider capping the form width (~1400px) for line length. AR ageing legend colours are report-defined. The ID column truncates harder because the subject column takes flex 2.
- **Demo data.** `seed_demo.py` / `seed_cleanup.py` in the session scratchpad; everything created is logged to `sites/trevo_seed_log.json` for cleanup.

## Round 2026-11-17 (c): colour harmony, fewer borders, sidebar, scrollbars

- **Semantic hues harmonised with emerald.** `--blue/green/yellow/orange/red/purple/pink-50…950` are overridden with one perceptual family: blue→sky, green→emerald, yellow→amber, purple→violet. Every status colour (pills, alerts, form banners, diffs) follows through Espresso's `--surface-*`/`--ink-*`/`--bg-*` chain. In dark mode, pill and alert surfaces (steps 1–2) are translucent tints of the 500 shade, dots use the 400 shade (desk/dark.scss draws dots with `--bg-*`), and form banners are tinted rather than solid 800.
- **Borders.** New `--trevo-divider` (light `#edf2ef`, dark `#1e2a25`) for section, tab and row dividers; `--trevo-border` (`#dfe7e2`) stays on fields and table frames. The form card frame is removed (white on white); one divider separates the form from activity.
- **Link fields.** `--control-bg` is set to the field surface inside Trevo fields, so the link arrow/clear overlay no longer paints a grey box; it is inset 1px so it doesn't cover the border.
- **Left sidebar.** v16's own collapse button (`.sidebar-collapse-arrow`, remembered in localStorage `desk-sidebar-collapsed`) is shown on desktop instead of hidden until the edge is hovered. Collapsing gives lists and forms the full width.
- **Scrollbars.** Thin, gray-300 thumb on a transparent track (standard properties, with a `::-webkit-scrollbar` fallback for Safari).
- **Tabs.** The tab links' `--card-bg` boxes are cleared (visible in dark mode).
- **Still report-defined.** The Accounts Receivable ageing chart hard-codes its own colours.

## Round 2026-11-17 (d): cleanup and brand surfaces

- **Removed** (git-tracked, staged):
  - `legacy_v15/`, `desk/api/` (four uncalled whitelisted endpoints, including a write endpoint), `www/index.*` (duplicated the `/` redirect hook).
  - The Trevo dashboard Page, with its API and JS/CSS. Migrate deleted the Page record, and `desk/install.py` also removes it.
  - The duplicate dock sidebar toggle.
- **Copyright.** The rebrand script no longer renames the Frappe Technologies copyright line, and deletes the translations it added earlier.
- **Tab titles.** `frappe.utils.set_title` is wrapped to append " · Trevo" (`boot.trevo.brand_name`).
- **Desk home.** The launcher tiles are centred cards (auto-fit grid overriding Frappe's inline `repeat(6, 1fr)`), with a greeting injected above them.
- **Web error and message pages** (`.error-page`): Trevo mark, display-font heading, white page, and a primary "Back to Home" button.
- **Sign-in.** The right side is white; the tinted brand panel stays on the left.
- **Naming.** `app_title` is "Trevo".
- **Ops note.** The dev container runs `frappe serve --noreload`, so Python changes (hooks, boot) need `docker restart trevo-v16-bench-1`.
- **Open.**
  - Frappe's "Framework" launcher tile keeps its name and grey icon. It comes from a Desktop Icon record; rename it to something like "System" if end users find "Framework" confusing.
  - The About dialog shows the app's git branch name.

## Round 2026-11-18: splash, install icons, app tiles

- **Scope.** Deliberately not branded here: print formats, outgoing emails, web footers. The customer-specific apps installed on top own and override those.
- **Loading splash.** The `.splash` from desk.html (the `splash_image` hook) is now a fixed full-screen layer: a centred 64px leaf, a "Trevo" wordmark (`::after`) and a slow pulse that respects reduced motion. Dark mode uses `#0f1814`, including the OS-dark "automatic" case before desk.js sets `data-theme`. Frappe's `.centered` translate is cleared. desk.js removes `.splash` after boot.
- **Install identity.**
  - `public/manifest.json`: name "Trevo", `start_url` `/desk`, scope `/`, standalone.
  - PNG icons generated from the logo SVG: `apple-touch-icon` (180), 192, 512, maskable 512 and `favicon-32`.
  - The desk adds the manifest, touch icon and `apple-mobile-web-app-title` at runtime, because desk.html has no hook for them.
  - `/signin` has them statically.
  - `theme-color` replaces Frappe's `#0089FF` with `--trevo-surface` and follows `data-theme` through a MutationObserver.
- **App tiles.** `extend_bootinfo` retitles Frappe's "Framework" app to "System", with `images/trevo-system.svg` (emerald sliders on a mint tile).

## Round 2026-11-18 (b): sign-in redesign

- **Source.** `/signin` was rebuilt from the user's mockup.
- **Brand panel:** deep emerald gradient (`#0b5a43` to `#052e22`); eyebrow "Four leaves, one system"; Anek Latin headline with a mint highlight; four leaves (Finance, Operations, People, Insight), each with a four-dot mark lighting its own leaf; a faint leaf watermark; footer "Trevo · Built on Frappe" (kept literal, not translated).
- **Form side:** 104px leaf, "Trevo" wordmark, tagline "The Operating System for Modern Business", and a flat form with no card. Buttons and links use the desk emerald. Dark mode is supported. Below 900px the brand panel is hidden.
- **Dropped from the mockup** because Frappe has no equivalent: "Create an account" and "Keep me signed in". "Other ways to sign in" (to `/login-classic`) shows only when social login or the email login link is enabled (`signin.py` `_other_sign_in_enabled`).
- **Login logic unchanged:** `/api/method/login`, `reset_password`, and the `/login-classic` fallback for 2FA.
- **Verified:** wrong password shows Frappe's message; the correct one lands on `redirect-to`; Forgot password without an email shows the hint; Show/Hide works; no overflow at 390, 1024 or 1440.

## 2026-11-18 (c): Surfaces outside forms and lists

I reviewed the workspace, awesomebar, toasts, message dialogs, empty states, dropdowns, notifications, kanban and calendar. The workspace, awesomebar, toasts, empty states, dropdowns and notifications already follow the theme. I fixed three gaps:

- **Dialog fields:** dialog fields used Frappe's grey filled input, while form fields were white and bordered. The field treatment is now a `trevo-field` mixin, used in both `.page-container` forms and `.modal-dialog`.
- **Modal scrim:** the scrim was 80% dark grey. It is now 45% green-black with a 2px blur, and 70% black in dark mode.
- **Calendar view:**
  - Today's date uses the brand fill instead of an ink-black badge.
  - Past events show at 70% opacity instead of 50%, so their tinted chips stay readable.

I checked this with screenshots in light and dark, and with `verify.mjs` at 390/820/1440 in both themes: no overflow and no page errors.

## 2026-11-18 (d): About dialog, ultra-wide forms, Kanban

- **About dialog:**
  - `branding.get_versions` replaces `frappe.utils.change_log.get_versions` through the documented `override_whitelisted_methods` hook. It clears `branch`, so customers no longer see git branch names such as `v16-desk-dashboard`. Versions and the "Copy Apps Version" button are unchanged.
  - The "Trevo Next" row uses the Trevo mark, matching its launcher tile.
  - The Frappe header and copyright are kept, as decided earlier.
- **Ultra-wide forms (1920px and wider):**
  - The record form's head and body are centred together at 1600px. On a 2560px screen, field columns had stretched to about 700px and the Save button sat far from the fields.
  - Lists and reports keep the full width.
  - Frappe's "Toggle Full Width" (`body.full-width`) opts out of the cap.
- **Kanban (v2):**
  - Columns use the table-head tint with a hairline border.
  - Column titles are semibold, and counts are shown as pills.
  - Cards are white with the Trevo border. Hovering lifts the card with a green-tinted border; a selected card gets a brand ring.
  - Dark mode keeps Frappe's outlined columns, in Trevo's border colour.
  - The `--kn-accent` drag/focus accent is brand green.
  - No board has records, so I checked this by rendering cards with Frappe's own `.kn-card` classes in the browser. Nothing was saved.
- **Gantt:** not styled. There are no Tasks to render, and creating some would mean writing business records.

I checked this with screenshots of the About dialog, Kanban in light and dark, and Sales Order and Customer forms at 2560px. `verify.mjs` reported no overflow and no errors.

## 2026-11-18 (e): Product banners, Gantt, demo data

- **"Switch to Frappe CRM" / "Switch to Helpdesk" sidebar banners:**
  - Turned off with Frappe's own System Settings switch, "Disable Product Suggestion". There is no CSS hiding.
  - `rebrand_to_trevo.run` writes both the field and the default that the desk reads, because `set_single_value` skips the System Settings save that normally syncs it.
- **Gantt view:**
  - The `--g-*` variables now come from Trevo tokens. Bars are a light brand tint with a brand edge, progress is a deeper tint, and the today line and date pill are brand green.
  - Rows and ticks use the divider colour, weekends the table-head tint, and labels use the desk font.
  - Frappe Gantt hard-codes a white background on the sticky month label, which showed as a white box in dark mode. It now uses the header token. The selector carries one extra class because the Gantt stylesheet loads after the bundle.
- **Demo data** was added so these views can be reviewed with real records. The user asked for it.
  - Project "Trevo Demo Rollout" with 6 dated Tasks (2 Completed, 1 Working at 45%, 3 Open).
  - 5 Leads, for example "Himalayan Traders" and "Thapa Electronics".
  - 4 Opportunities, two linked to existing Customers and two to the demo Leads.
  - No existing records were changed.

I checked this with screenshots of the Lead and Opportunity Kanban, Gantt in light and dark, and the CRM and Support sidebars (no banner). `verify.mjs` reported no overflow and no errors.
