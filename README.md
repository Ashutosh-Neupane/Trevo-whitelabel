# Trevo Whitelabel

Premium visual identity layer for Frappe/ERPNext v16. Transforms the standard Frappe desk into the **Trevo Cloud** experience using a Leaf Green design system.

## What This App Does

- Replaces all Frappe/ERPNext branding with Trevo Cloud identity (logo, title, favicon, about dialog)
- Applies a full design token system (`_tokens.scss`) — Leaf Green palette, Inter Tight typography, warm neutral surfaces
- Overrides every major Frappe UI surface: navbar, sidebar, forms, modals, lists, grids, charts, reports
- Patches Frappe's live form renderer (`section.js`, `column.js`) with Trevo card-style sections and columns
- Replaces the Frappe Form Builder Vue components with a custom Trevo Form Studio
- Repaints all system SVG icons to match the brand
- Supports sidebar collapse to a 52px icon-only rail with centered icons and no padding bleed
- Supports density toggle (`comfortable` / `compact`) via `body[data-density]`
- Supports dark mode via `[data-theme="dark"]`

## File Structure

```
trevo_whitelabel/
├── public/
│   ├── css/
│   │   ├── trevo_v1.bundle.scss        # Entry point — imports all partials
│   │   └── trevo/
│   │       ├── _tokens.scss            # Design tokens + Frappe variable overrides
│   │       ├── _base.scss              # Resets, typography, motion, print
│   │       ├── _layout.scss            # Navbar, sidebar, page structure
│   │       ├── _components.scss        # Inputs, buttons, cards, modals, grids
│   │       ├── _form.scss              # Live doctype form — sections, columns, fields
│   │       ├── _login.scss             # Login page
│   │       └── _overrides.scss         # Frappe surface overrides loaded last
│   ├── custom_form_builder/
│   │   ├── FormBuilder.vue             # Replaces frappe/public/js/form_builder/FormBuilder.vue
│   │   ├── Sidebar.vue                 # Replaces .../form_builder/components/Sidebar.vue
│   │   ├── Section.vue                 # Replaces .../form_builder/components/Section.vue
│   │   ├── Column.vue                  # Replaces .../form_builder/components/Column.vue
│   │   ├── SectionStats.vue            # New component added to form builder
│   │   ├── section_live.js             # Replaces frappe/public/js/frappe/form/section.js
│   │   └── column_live.js              # Replaces frappe/public/js/frappe/form/column.js
│   ├── images/
│   │   └── TrevoCloudLogo.svg
│   └── js/
│       └── trevo_v1.bundle.js          # Runtime JS: logo swap, ⌘K, density, sidebar collapse
├── scripts/
│   ├── rebrand_form_builder.py         # Patches Frappe source with custom_form_builder files
│   ├── rebrand_to_trevo.py             # Renames app titles in the database
│   ├── repaint_svgs.py                 # Colorizes system SVGs to Trevo brand
│   ├── fix_navbar_and_svgs.py
│   └── inject_branding.py
├── hooks.py
└── ...
```

## Installation (bare bench)

```bash
bench get-app https://github.com/Ashutosh-Neupane/Trevo-whitelabel.git
bench --site [your-site] install-app trevo_whitelabel
bench --site [your-site] migrate
bench build --force
bench --site [your-site] clear-cache
```

After install, the `after_install` hooks run automatically:
- `repaint_svgs.run`
- `rebrand_to_trevo.run`
- `rebrand_form_builder.run`

## Manual Script Execution

If you need to re-run any step individually:

```bash
bench --site [your-site] execute trevo_whitelabel.scripts.rebrand_to_trevo.run
bench --site [your-site] execute trevo_whitelabel.scripts.repaint_svgs.run
bench --site [your-site] execute trevo_whitelabel.scripts.rebrand_form_builder.run
bench build --force
bench --site [your-site] clear-cache
```

> `rebrand_form_builder.run` backs up original Frappe files as `.orig` before patching. To restore originals, rename `.orig` files back before rebuilding.

## Docker (trevo_whitelabel stack)

Use `docker-compose.trevo_whitelabel.yml` from the workspace root:

```bash
docker compose -f docker-compose.trevo_whitelabel.yml up --build
```

The stack includes: `backend`, `frontend` (nginx), `websocket`, `queue-long`, `queue-short`, `scheduler`, `db` (MariaDB 10.6), `redis-cache`, `redis-queue`.

**Important — volume mount patch order:**

The `backend` service mounts `./trevo_whitelabel` as a live volume, which restores the original Frappe source files after the Docker build patched them. To fix this, the `backend` service re-runs `rebrand_form_builder.py` before starting gunicorn so the custom Form Builder Vue files and live form JS patches are always active.

**First run** creates the site, installs all apps, runs migrations, patches form builder, and builds assets automatically inside `create-site`.

**Subsequent runs** skip site creation and only run migrations + asset rebuild.

## Sidebar Collapse Behaviour

The sidebar collapses to a 52px icon-only rail. Key CSS rules that make this work correctly:

- `.body-sidebar` has `padding: 0` — no default padding bleeds content outside the rail
- `.body-sidebar.sidebar-collapsed` also forces `padding: 0` and sets `width: 52px`
- `.standard-sidebar-item` in collapsed state gets `width: 52px; justify-content: center; margin: 1px 0` so icons are truly centered
- The collapse toggle button gets `width: 52px; padding: 0; justify-content: center`
- Text labels, section breaks, and subtitles get `opacity: 0; width: 0; pointer-events: none`

The JS in `trevo_v1.bundle.js` (`watchSidebarCollapse`) observes class and style mutations on `.body-sidebar` and syncs the `sidebar-collapsed` class.

## Design Tokens

All tokens are in `_tokens.scss`. Key values:

| Token | Value |
|---|---|
| `--tv-primary` | `#6ba44b` (Leaf Green) |
| `--tv-deep` | `#2d7a4f` (Forest) |
| `--tv-deep-900` | `#143628` |
| `--tv-bg` | `#f7f8f5` |
| `--tv-surface` | `#ffffff` |
| `--tv-font-sans` | Inter Tight |
| `--tv-font-mono` | JetBrains Mono |
| `--tv-topbar-h` | `56px` |

Frappe's own variable names (`--primary`, `--bg-color`, `--border-color`, etc.) are mapped to Trevo tokens so every native Frappe component inherits the brand automatically.

## Custom Form Builder (Form Studio)

`rebrand_form_builder.py` copies files from `public/custom_form_builder/` over Frappe's form builder source before `bench build`. This gives the Form Builder page a Trevo-branded canvas with:

- Banner bar with Form Studio title, unsaved/saved badge, doctype name
- Resizable sidebar (256–384px, persisted to localStorage)
- Dot-grid canvas background
- Trevo card-style sections and columns with hover/selected states
- Keyboard shortcuts: `⌘S` to save, `⌫` to delete selected field

---

© 2026 Dots and Dashes Technologies
