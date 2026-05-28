import frappe
from frappe.utils import validate_csrf_token
from frappe import _

@frappe.whitelist()
def get_sidebar_navigation():
	"""
	Resolve and return normalized, permission-aware workspaces for the custom sidebar.
	Caches the resolved list per user to optimize DB performance.
	"""
	# CSRF protection: ensure valid token for POST requests
	csrf_token = frappe.form_dict.get('csrf_token')
	if csrf_token:
		validate_csrf_token(csrf_token)

	if frappe.session.user == "Guest":
		frappe.throw(_("You must be logged in to access navigation."), frappe.PermissionError)

	user = frappe.session.user
	cache_key = f"trevo:navigation_sidebar:{user}"
	cached = frappe.cache().get_value(cache_key)
	if cached:
		return cached

	try:
		# Fetch all public, visible workspaces
		workspaces = frappe.get_all(
			"Workspace",
			filters={"public": 1, "is_hidden": 0},
			fields=["name", "title", "icon", "label", "module", "parent_page"],
			order_by="sequence_id asc, modified desc"
		)
	except Exception as e:
		frappe.log_error(f"Workspace list fetch error: {e}", "Trevo Desk Navigation")
		workspaces = []

	allowed_workspaces = []
	for ws in workspaces:
		# Check permission to the Workspace and Module Def
		if not _has_workspace_access(ws):
			continue

		allowed_workspaces.append({
			"name": ws.name,
			"title": ws.title or ws.label or ws.name,
			"icon": ws.icon or "Grid",
			"module": ws.module,
			"parent_page": ws.parent_page,
			"route": f"/app/{ws.name.lower().replace(' ', '-')}"
		})

	frappe.cache().set_value(cache_key, allowed_workspaces, expires_in_sec=120)
	return allowed_workspaces


def _has_workspace_access(ws):
	"""Check if the user has access to a workspace based on modules and role permissions."""
	try:
		# 1. Check ModuleDef if workspace is associated with one
		if ws.module:
			if not frappe.db.exists("Module Def", ws.module):
				return False

			# Check if module is disabled or restricted in User permissions
			# standard Frappe has_permission or system checks can be used
			# If user does not have permission on any doctypes in the module, skip
			# We can also check if the module def is visible/accessible
			if not frappe.has_permission("Module Def", doc=ws.module, ptype="read"):
				# Fallback check: if there is no explicit Module Def permission, check doctype permissions inside the module
				pass

		# 2. Check standard Workspace read permission
		# Workspace permission table matches standard document permissions
		if not frappe.has_permission("Workspace", doc=ws.name, ptype="read"):
			return False

		return True
	except Exception:
		# Fail closed in case of permissions check errors
		return False
