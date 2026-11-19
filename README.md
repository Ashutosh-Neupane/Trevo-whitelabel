# Trevo Whitelabel

Trevo Cloud branding and theme for Frappe v16 + ERPNext v16. Trevo is a skin: it sets
Frappe's own design tokens, styles a handful of components, and listens to Frappe's public
events. It does not patch Frappe or ERPNext files, replace core classes, or change how forms,
lists, permissions or calculations behave.

## What it does

- **Brand:** the Trevo logo, emerald `#059669` brand colour, and "Trevo" / "Trevo Next"
  product names via Custom Translations. Copyright notices for Frappe and ERPNext are left
  unchanged.
- **Theme** (`public/css/trevo_theme.bundle.scss`, loaded on desk and website):
  - Fonts: Helvetica Neue for body text and Anek Latin for headings (OFL, bundled in
    `public/fonts/`). Currency symbols come from Inter.
  - Colours: emerald-tinted neutral greys, and status colours (info, success, warning,
    danger) tuned to sit with the brand, in light and dark mode.
  - Pages are a single white surface. Fields, list results, child tables and report tables
    share one table style.
  - Sticky page heads, form tabs and list headers lift with a soft shadow once content
    scrolls under them.
  - The left-sidebar collapse button is always visible.
  - Dialog fields match form fields; the dialog scrim is lighter and blurred.
  - Calendar, Kanban and Gantt views use the brand accent and table colours.
  - On screens 1920px and wider, record forms are centred at 1600px. Frappe's "Toggle Full Width" turns this off.
  - Browser tabs read "<page> · Trevo". The 404 and message pages carry the Trevo mark.
- **Desk behaviours** (`public/js/trevo_desk.bundle.js`):
  - Form side panel closed by default, with a header toggle that's remembered per DocType.
  - Record image next to the form title.
  - Chart palette from the Trevo tokens.
  - Scroll-state classes for the sticky headers.
- **Home** (`page/trevo_home`, `desk/home.py`): `/desk` opens the Trevo home, with search,
  notifications and the user menu; Create buttons; KPI cards (Number Cards) for the modules the
  user may open, filtered by their permissions; each app's modules; and Recent (what the user
  submitted, edited, opened and viewed). Frappe's apps screen stays at `/desk/desktop`.
- **About dialog:** git branch names are hidden, and Trevo Next shows the Trevo mark
  (`branding.get_versions`, via `override_whitelisted_methods`).
- **No product banners:** Frappe's "Switch to Frappe CRM / Helpdesk" sidebar banners are
  turned off with System Settings > Disable Product Suggestion.
- **Sign-in:** `/signin` is the login page. `/login` redirects there, and the stock page
  remains at `/login-classic`.
- **Settings:** the *Trevo Settings* single DocType holds site options such as whether the
  form side panel opens by default.

## Install

```bash
bench get-app trevo_whitelabel <repo-url>
bench --site <site> install-app trevo_whitelabel
bench build --app trevo_whitelabel
```

`after_install` and `after_migrate` run `scripts/rebrand_to_trevo.py`, which sets the
names, logo, colour and translations, and `desk/install.py`, which makes `/desk` open the
Trevo home unless the site has chosen its own home page.

## Develop

- Edit `public/css/trevo_theme.bundle.scss` or `public/js/trevo_desk.bundle.js`, then run
  `bench build --app trevo_whitelabel && bench --site <site> clear-cache`.
- Change colours by changing tokens (`--trevo-*` and the hue scales near the top of the
  SCSS), not by restyling components.
- `WHITELABEL_UX_PLAN.md` records the design decisions and the visual review history.

## License

MIT
