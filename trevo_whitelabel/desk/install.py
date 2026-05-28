import frappe
import logging


def after_install():
    """Hook executed after app installation during site creation."""
    ensure_trevo_dashboard_page()


def ensure_trevo_dashboard_page():
    """Create or update the Trevo Dashboard page and route.

    This function is called from ``after_install`` during ``bench new-site``
    (or the Docker ``create-site`` service). It makes sure a ``Page``
    document named ``trevo-dashboard`` exists, sets its route to
    ``/trevo-dashboard`` and includes the HTML template shipped with the app.
    Errors are logged via ``frappe.log_error`` so they appear in the site
    creation logs, and the exception is re‑raised to surface any fatal issues.
    """
    try:
        # Ensure Module Def exists to prevent LinkValidationError
        if not frappe.db.exists("Module Def", "Trevo Whitelabel"):
            frappe.get_doc({
                "doctype": "Module Def",
                "module_name": "Trevo Whitelabel",
                "app_name": "trevo_whitelabel"
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Page", "trevo-dashboard"):
            frappe.get_doc({
                "doctype": "Page",
                "name": "trevo-dashboard",
                "page_name": "trevo-dashboard",
                "module": "Trevo Whitelabel",
                "title": "Trevo Dashboard",
                "route": "/trevo-dashboard",
                "content": "{% include \"trevo_whitelabel/trevo_dashboard/trevo_dashboard.html\" %}"
            }).insert(ignore_permissions=True)
        else:
            doc = frappe.get_doc("Page", "trevo-dashboard")
            doc.route = "/trevo-dashboard"
            doc.title = "Trevo Dashboard"
            doc.content = "{% include \"trevo_whitelabel/trevo_dashboard/trevo_dashboard.html\" %}"
            doc.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        # Log the error for visibility in create‑site logs
        frappe.log_error(message=str(e), title="trevo_whitelabel: ensure_trevo_dashboard_page")
        raise
