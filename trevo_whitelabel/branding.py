import frappe


TREVO_LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"


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

    return context


def extend_bootinfo(bootinfo):
    """Show the Trevo mark for ERPNext in the desk (app switcher, sidebar header).

    Done through the boot payload, so no ERPNext or Frappe file is modified.
    """
    bootinfo.app_logo_url = TREVO_LOGO
    for app in bootinfo.get("app_data") or []:
        if app.get("app_name") == "erpnext":
            app["app_logo_url"] = TREVO_LOGO

    # Read by trevo_desk.bundle.js. Guarded: the DocType does not exist until the first migrate.
    show_sidebar = 0
    try:
        show_sidebar = frappe.utils.cint(frappe.db.get_single_value("Trevo Settings", "show_form_sidebar"))
    except Exception:
        pass
    bootinfo.trevo = {"show_form_sidebar": show_sidebar}
