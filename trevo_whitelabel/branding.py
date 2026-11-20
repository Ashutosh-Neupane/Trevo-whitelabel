import frappe


TREVO_LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
SYSTEM_ICON = "/assets/trevo_whitelabel/images/trevo-system.svg"


def get_context(context):
    """
    Force Trevo branding into the website context.
    """
    context.app_name = "Trevo"
    context.app_title = "Trevo Cloud"
    context.logo = TREVO_LOGO
    context.app_logo_url = TREVO_LOGO
    context.favicon = TREVO_LOGO
    context.splash_image = TREVO_LOGO
    context.brand_html = "Trevo Cloud"

    # Independent Home Page Logic
    # ---------------------------
    # If ecommerce is installed, use its home page.
    # Otherwise, ensure we don't redirect to login by defaulting to 'index'.
    installed_apps = frappe.get_installed_apps()
    if "denimnation_ecommerce" in installed_apps:
        context.home_page = "shop"
    else:
        context.home_page = "desk"

    _signed_in_not_permitted()
    return context


def _signed_in_not_permitted():
    """Frappe's "Not Permitted" page always offers "Login", also to someone already signed in:
    a portal customer who opens /desk was sent to a login form they had just passed. For a
    signed-in user, point it at where they can go instead (portal customers: their portal;
    desk users: the desk). The page and its 403 status are Frappe's; only the button changes.
    It is applied to the response context, which Frappe merges after this hook."""
    page = (getattr(frappe.local, "response", None) or {}).get("context")
    if not page or page.get("primary_label") != frappe._("Login") or frappe.session.user == "Guest":
        return
    if frappe.session.data.user_type == "Website User":
        page["primary_action"], page["primary_label"] = "/me", frappe._("Go to my portal")
        if (frappe.request.path or "").startswith("/desk"):
            page["message"] = frappe._(
                "The desk is for staff accounts. Your orders, invoices and profile are in your portal.")
    else:
        page["primary_action"], page["primary_label"] = "/desk", frappe._("Back to the desk")


@frappe.whitelist()
def get_versions():
    """About dialog (Help > About): same data as Frappe's get_versions, without git branch names.

    Frappe prints "version (branch)" for any app on a git branch, so customers saw internal
    branch names such as a feature branch. Versions stay; "Copy Apps Version" still copies
    branch_version for support. Registered via override_whitelisted_methods in hooks.py.
    """
    from frappe.utils.change_log import get_versions as frappe_get_versions

    # Copy: never mutate whatever Frappe may have cached.
    versions = {name: {**app, "branch": ""} for name, app in frappe_get_versions().items()}
    # ERPNext is "Trevo Next" in the desk; show the same mark here as on the launcher tile.
    if "erpnext" in versions:
        versions["erpnext"]["logo"] = TREVO_LOGO
    return versions


def extend_bootinfo(bootinfo):
    """Show the Trevo mark for ERPNext in the desk (app switcher, sidebar header).

    Done through the boot payload, so no ERPNext or Frappe file is modified.
    """
    bootinfo.app_logo_url = TREVO_LOGO
    for app in bootinfo.get("app_data") or []:
        if app.get("app_name") == "erpnext":
            app["app_logo_url"] = TREVO_LOGO
            app["app_title"] = "Trevo Next"
        elif app.get("app_name") == "frappe":
            # Frappe's admin app (users, settings, integrations) is titled "Framework", which
            # means nothing to business users, and wears a grey cube. Same app, clearer label.
            app["app_logo_url"] = SYSTEM_ICON
            app["app_title"] = "System"

    # Read by trevo_desk.bundle.js. Guarded: the DocType does not exist until the first migrate.
    show_sidebar = 0
    try:
        show_sidebar = frappe.utils.cint(frappe.db.get_single_value("Trevo Settings", "show_form_sidebar"))
    except Exception:
        pass
    # brand_name: appended to browser-tab titles by trevo_desk.bundle.js.
    bootinfo.trevo = {"show_form_sidebar": show_sidebar, "brand_name": "Trevo"}
