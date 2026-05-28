import frappe
from frappe import _

no_cache = 1


def get_context(context):
    """
    Trevo Cloud custom desk context handler.

    Routes:
      /desk  → custom Trevo dashboard  (is_custom_desk = True)
      /      → redirected by app_home to /desk (is_custom_desk = True)
      /app/* → standard Frappe SPA container  (is_custom_desk = False)
    """
    # ── Standard Frappe desk bootstrap ──────────────────────────────────────
    try:
        from frappe.www.desk import get_context as _frappe_get_context
        result = _frappe_get_context(context)
        if result is not None:
            context = result
    except Exception as exc:
        frappe.log_error(f"Frappe desk context bootstrap error: {exc}", "Trevo Desk")
        _apply_minimal_context(context)

    # ── Route detection ──────────────────────────────────────────────────────
    raw_path = (getattr(frappe.request, "path", None) or "").rstrip("/")
    request_path = raw_path if raw_path else "/"

    # Our custom dashboard renders for /desk and falls back to / for safety.
    context.is_custom_desk = request_path in ("/desk", "/", "")

    # ── Custom dashboard data ────────────────────────────────────────────────
    if context.is_custom_desk:
        # Redirect unauthenticated guests to login
        if frappe.session.user == "Guest":
            frappe.local.flags.redirect_location = "/login"
            frappe.local.response["type"] = "redirect"
            frappe.local.response["location"] = "/login"
            return context

        # Load dashboard metrics, tasks, activity
        try:
            from trevo_whitelabel.desk_dashboard import get_desk_dashboard_data
            context.dashboard_data = get_desk_dashboard_data()
        except Exception as e:
            frappe.log_error(f"Trevo dashboard data error: {e}", "Trevo Desk Dashboard")
            context.dashboard_data = _empty_dashboard_data()

        # Guard: ensure dashboard_data is never None
        if not context.dashboard_data:
            context.dashboard_data = _empty_dashboard_data()

        # Load visible workspaces for sidebar
        context.sidebar_workspaces = _fetch_workspaces()

        # Resolve current desk theme
        try:
            theme_val = (
                frappe.db.get_value("User", frappe.session.user, "desk_theme") or "Light"
            )
            context.desk_theme = theme_val
        except Exception:
            context.desk_theme = getattr(context, "desk_theme", "Light") or "Light"

    else:
        # Standard Frappe SPA — no custom data needed
        context.dashboard_data = None
        context.sidebar_workspaces = []

    return context


# ── Helpers ──────────────────────────────────────────────────────────────────

def _apply_minimal_context(context):
    """Fallback boot context when frappe.www.desk.get_context is unavailable."""
    import json as _json

    try:
        boot = frappe.get_boot_info() if hasattr(frappe, "get_boot_info") else {}
        context.boot = _json.dumps(boot, default=str)
    except Exception:
        context.boot = "{}"

    try:
        context.csrf_token = frappe.generate_hash(length=16)
    except Exception:
        context.csrf_token = ""

    context.desk_theme = "Light"
    context.layout_direction = "ltr"
    context.lang = getattr(frappe.local, "lang", "en") or "en"
    context.build_version = "1"
    context.app_name = "Trevo Cloud"
    context.favicon = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
    context.app_include_css = []
    context.app_include_js = []
    context.app_include_icons = []
    context.sounds = []
    context.dev_server = False


def _empty_dashboard_data():
    """Return a safe empty dashboard data structure to avoid Jinja template errors."""
    user = frappe.session.user or "Guest"
    try:
        full_name = frappe.utils.get_fullname(user) or user
    except Exception:
        full_name = user
    first_name = full_name.split(" ", 1)[0] if full_name else "User"
    return {
        "user": {
            "id": user,
            "full_name": full_name,
            "first_name": first_name,
            "roles": [],
        },
        "stats": {
            "open_tasks": 0,
            "overdue_tasks": 0,
            "unread_notifications": 0,
            "draft_documents": 0,
            "submitted_documents": 0,
            "approved_documents": 0,
            "pending_documents": 0,
        },
        "tasks": [],
        "recent_activity": [],
        "recent_documents": [],
        "workspaces": [],
        "quick_actions": [],
    }


def _fetch_workspaces():
    """Fetch all visible public workspaces for the custom sidebar."""
    try:
        return frappe.get_list(
            "Workspace",
            filters={"public": 1, "is_hidden": 0},
            fields=["name", "title", "icon", "label", "module", "parent_page"],
            order_by="sequence_id asc",
            limit_page_length=60,
        )
    except Exception as e:
        frappe.log_error(f"Workspace fetch error for sidebar: {e}", "Trevo Desk")
        return []
