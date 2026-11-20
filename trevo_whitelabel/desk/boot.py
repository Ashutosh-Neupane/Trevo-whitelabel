"""Leave out of the module sidebars the links the user would only get an error from.

Frappe lists every report that has no roles in every user's sidebar, without checking the
Custom Role rows that narrow it (desk/permissions.py writes those). So "Maintenance Schedules"
stayed in the Quality and Stock sidebars for users the report then refused. Likewise a sidebar
can link a workspace in a module the user's Module Profile blocks ("Home" of Setup), which the
workspace then refuses.

This runs from `extend_bootinfo`, after Frappe has built `bootinfo.module_sidebars`, and only
drops items from the user's own boot payload. Nothing is hidden that the user could open, and
nothing in Frappe/ERPNext is changed.
"""

import frappe
from frappe.utils import has_common


def prune_sidebars(bootinfo):
	sidebars = bootinfo.get("module_sidebars") or {}
	if not sidebars:
		return
	roles = frappe.get_roles()
	# Administrators may open everything; for them only links to pages that don't exist go
	# (ERPNext's sidebar links a "background-task" page that no app ships: a 404).
	admin = frappe.session.user == "Administrator" or "System Manager" in roles
	ok = {}
	for sidebar in sidebars.values():
		items = sidebar.get("items")
		if not items:
			continue
		kept = [it for it in items if _page_exists(it, ok) and (admin or _usable(it, roles, ok))]
		sidebar["items"] = _drop_empty_sections(kept)


def _page_exists(item, ok):
	if (item.get("link_type") or "").lower() != "page" or not item.get("link_to"):
		return True
	key = ("page-exists", item["link_to"])
	if key not in ok:
		ok[key] = bool(frappe.db.exists("Page", item["link_to"]))
	return ok[key]


def _usable(item, roles, ok):
	kind = (item.get("link_type") or "").lower()
	name = item.get("link_to")
	if not name or kind not in ("report", "workspace"):
		return True
	key = (kind, name)
	if key not in ok:
		try:
			ok[key] = _report_ok(name) if kind == "report" else _workspace_ok(name, roles)
		except Exception:
			ok[key] = True  # never hide a link because the check itself failed
	return ok[key]


def _report_ok(name):
	if not frappe.db.exists("Report", name):
		return True
	report = frappe.get_cached_doc("Report", name)
	if not report.is_permitted():
		return False
	return not report.ref_doctype or bool(frappe.has_permission(report.ref_doctype, "report"))


def _workspace_ok(name, roles):
	from frappe.core.doctype.custom_role.custom_role import get_custom_allowed_roles
	from frappe.utils.modules import is_module_visible

	if not frappe.db.exists("Workspace", name):
		return True
	ws = frappe.get_cached_doc("Workspace", name)
	if ws.for_user and ws.for_user == frappe.session.user:
		return True
	if ws.module and not is_module_visible(ws.module):
		return False
	allowed = [d.role for d in ws.roles] + get_custom_allowed_roles("page", ws.name)
	return not allowed or has_common(roles, allowed)


def _drop_empty_sections(items):
	"""A section header whose links were all removed would be left as an empty heading."""
	out = []
	for i, it in enumerate(items):
		if it.get("type") == "Section Break" and not it.get("child"):
			nxt = items[i + 1] if i + 1 < len(items) else None
			if not nxt or not nxt.get("child"):
				continue
		out.append(it)
	return out
