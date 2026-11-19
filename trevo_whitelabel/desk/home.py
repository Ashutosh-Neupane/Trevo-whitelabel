"""Data for the Trevo home Page (page/trevo_home): KPI cards and recent items.

Everything is filtered by Frappe's own permission rules, so two users see different homes:

KPIs
	ERPNext ships Number Cards on each module's workspace ("Sales Orders to Deliver",
	"Total Outgoing Bills", ...). A card is offered when
	  1. the user may open a workspace that shows it (Workspace.is_permitted: module not
	     blocked, role allowed),
	  2. the user may read the card (Number Card permission: the DocType or report behind it),
	  3. it belongs to a business app (framework admin cards such as Error Logs are left out).
	Only card names are returned. The values are computed by Frappe's NumberCardWidget in the
	browser through number_card.get_result, which uses frappe.get_list, so User Permissions
	(for example, one Company only) apply to every number.

Recent
	What the user did, newest first, each row labelled with the action:
	  - Submitted / Cancelled / Edited: documents the user changed, from Frappe's Version log
	  - Opened: documents opened in this browser. Frappe keeps no server record of form visits
	    (Route History skips forms), so the desk bundle remembers them in localStorage and
	    sends them here
	  - Viewed: lists and reports, from Route History
	A document is shown only if it still exists and the user may still read it, by title.
"""

import frappe
from frappe import _

KPI_EXCLUDED_APPS = {"frappe"}
RECENT_LIMIT = 6
RECENT_SCAN = 80


@frappe.whitelist()
def get_home_data(opened=None):
	readable = set(frappe.get_user().get_can_read())
	return {
		"kpis": get_kpi_groups(),
		"recent": get_recent(frappe.parse_json(opened) or []),
		"modules": get_usable_modules(readable),
		"doctype_modules": get_doctype_modules(),
		"custom": get_custom_doctypes(readable),
	}


def get_doctype_modules():
	"""Modules that own standard DocTypes. v16 also has grouping modules (Build, Users, Data,
	System) that only link to DocTypes elsewhere; the home judges those by their links."""
	return frappe.get_all(
		"DocType", filters={"istable": 0, "custom": 0}, pluck="module", distinct=True
	)


def get_usable_modules(readable):
	"""Modules where the user may read at least one standard (non-child) DocType.

	Frappe's dock lists every module tile to every desk user; a module tile is only useful
	when something in it opens. Custom DocTypes are left out here (a custom DocType filed under
	Selling should not make the whole Selling module appear) and get their own group instead."""
	if not readable:
		return []
	modules = frappe.get_all(
		"DocType",
		filters={"name": ["in", list(readable)], "istable": 0, "custom": 0},
		pluck="module",
		distinct=True,
	)
	blocked = set(frappe.get_doc("User", frappe.session.user).get_blocked_modules() or [])
	return sorted(m for m in modules if m not in blocked)


CUSTOM_LIMIT = 12


def get_custom_doctypes(readable):
	"""DocTypes made on this site (Customize > New DocType) that the user may read.

	They have no workspace or module tile of their own, so without this a role made for one
	custom DocType ("Field Agent" for "Site Visit") would find nothing on the home."""
	if not readable:
		return []
	rows = frappe.get_all(
		"DocType",
		filters={"name": ["in", list(readable)], "istable": 0, "custom": 1, "issingle": 0},
		fields=["name", "module"],
		order_by="modified desc",
		limit=CUSTOM_LIMIT,
	)
	# The home groups them under their module, with the module's app (Selling → Trevo Next).
	apps = dict(
		frappe.get_all(
			"Module Def",
			filters={"name": ["in", list({row.module for row in rows})]},
			fields=["name", "app_name"],
			as_list=True,
		)
	)
	return [
		{
			"doctype": row.name,
			"label": _(row.name),
			"module": row.module,
			"app": apps.get(row.module),
			"can_create": bool(frappe.has_permission(row.name, "create")),
		}
		for row in rows
	]


def get_kpi_groups():
	if not frappe.has_permission("Number Card", throw=False):
		return []

	rows = frappe.db.sql(
		"""
		select ws.name as workspace, ws.module as workspace_module, wnc.number_card_name as card,
			wnc.label, nc.module as card_module, nc.is_public, nc.owner, md.app_name
		from `tabWorkspace Number Card` wnc
		join `tabWorkspace` ws on ws.name = wnc.parent
		join `tabNumber Card` nc on nc.name = wnc.number_card_name
		left join `tabModule Def` md on md.name = ws.module
		where wnc.parenttype = 'Workspace' and ws.public = 1
		order by ws.sequence_id, ws.name, wnc.idx
		""",
		as_dict=True,
	)

	permitted_workspace = {}
	usable = []
	for row in rows:
		if row.app_name in KPI_EXCLUDED_APPS:
			continue
		if not (row.is_public or row.owner == frappe.session.user):
			continue
		if row.workspace not in permitted_workspace:
			permitted_workspace[row.workspace] = _workspace_permitted(row.workspace)
		if not permitted_workspace[row.workspace]:
			continue
		usable.append(row)

	visible_modules = {row.workspace_module for row in usable}
	groups = {}
	seen = set()
	for row in usable:
		if row.card in seen or not frappe.has_permission("Number Card", doc=row.card):
			continue
		seen.add(row.card)
		# A card shown on several workspaces ("Annual Sales" on Home and Selling) is filed
		# under its own module when the user can see that module.
		module = row.card_module if row.card_module in visible_modules else row.workspace_module
		groups.setdefault(module, []).append({"name": row.card, "label": _(row.label or row.card)})

	# The module's own workspace (Selling for "Selling"), linked from its tab.
	workspace_of = {}
	for row in usable:
		if row.workspace == row.workspace_module or row.workspace_module not in workspace_of:
			workspace_of[row.workspace_module] = row.workspace

	charts = _module_charts(permitted_workspace)
	return [
		{
			"module": module,
			"workspace": workspace_of.get(module),
			"cards": cards,
			"chart": charts.get(module),
		}
		for module, cards in groups.items()
	]


def _module_charts(permitted_workspace):
	"""First Dashboard Chart of each module's workspaces that the user may read.

	Same rules as the cards: a public workspace the user may open, a public chart (or their
	own), and Dashboard Chart permission (the DocType or report behind it). Values are drawn
	by Frappe's ChartWidget, which reads through the same permission checks."""
	if not frappe.has_permission("Dashboard Chart", throw=False):
		return {}

	rows = frappe.db.sql(
		"""
		select ws.name as workspace, ws.module, wc.chart_name as chart, wc.label,
			dc.is_public, dc.owner, md.app_name
		from `tabWorkspace Chart` wc
		join `tabWorkspace` ws on ws.name = wc.parent
		join `tabDashboard Chart` dc on dc.name = wc.chart_name
		left join `tabModule Def` md on md.name = ws.module
		where wc.parenttype = 'Workspace' and ws.public = 1
		order by ws.sequence_id, ws.name, wc.idx
		""",
		as_dict=True,
	)
	charts = {}
	for row in rows:
		if row.module in charts or row.app_name in KPI_EXCLUDED_APPS:
			continue
		if not (row.is_public or row.owner == frappe.session.user):
			continue
		if row.workspace not in permitted_workspace:
			permitted_workspace[row.workspace] = _workspace_permitted(row.workspace)
		if not permitted_workspace[row.workspace]:
			continue
		if not frappe.has_permission("Dashboard Chart", doc=row.chart):
			continue
		charts[row.module] = {"name": row.chart, "label": _(row.label or row.chart)}
	return charts


def _workspace_permitted(name):
	from frappe.desk.desktop import Workspace

	try:
		return bool(Workspace({"name": name}, minimal=True).is_permitted())
	except Exception:
		return False


# Records of the system rather than work a user would return to.
RECENT_SKIP_DOCTYPES = {
	"Access Log", "Activity Log", "Comment", "Communication", "Error Log", "Route History",
	"Scheduled Job Log", "Version", "View Log",
}
OPENED_LIMIT = 30


def get_recent(opened):
	candidates = []  # (when, kind, payload)

	for row in frappe.get_all(
		"Version",
		filters={"owner": frappe.session.user},
		fields=["ref_doctype", "docname", "creation", "data"],
		order_by="creation desc",
		limit=RECENT_SCAN,
	):
		candidates.append((row.creation, _version_action(row.data), (row.ref_doctype, row.docname)))

	for row in (opened or [])[:OPENED_LIMIT]:
		if isinstance(row, dict) and row.get("doctype") and row.get("name") and row.get("when"):
			try:
				when = frappe.utils.get_datetime(row["when"])
			except Exception:
				continue
			candidates.append((when, "Opened", (str(row["doctype"]), str(row["name"]))))

	for row in frappe.get_all(
		"Route History",
		filters={"user": frappe.session.user},
		fields=["route", "creation"],
		order_by="creation desc",
		limit=RECENT_SCAN,
	):
		candidates.append((row.creation, "Viewed", row.route))

	candidates.sort(key=lambda c: c[0], reverse=True)
	items, seen = [], set()
	for when, action, target in candidates:
		item = _doc_item(*target) if isinstance(target, tuple) else _route_item(target)
		if not item or item["key"] in seen:
			continue
		seen.add(item["key"])
		# action_key is stable for styling; action is the translated label.
		item.update({"action": _(action), "action_key": action, "when": when})
		items.append(item)
		if len(items) >= RECENT_LIMIT:
			break
	return items


def _version_action(data):
	try:
		changed = (frappe.parse_json(data) or {}).get("changed") or []
	except Exception:
		changed = []
	for field, old, new in (c for c in changed if len(c) == 3):
		if field == "docstatus" and new == 1:
			return "Submitted"
		if field == "docstatus" and new == 2:
			return "Cancelled"
	return "Edited"


def _doc_item(doctype, name):
	try:
		if doctype in RECENT_SKIP_DOCTYPES or not frappe.db.exists("DocType", doctype):
			return None
		meta = frappe.get_meta(doctype)
		if meta.istable or not frappe.db.exists(doctype, name):
			return None
		if not frappe.has_permission(doctype, "read", doc=name):
			return None
		title_field = meta.get_title_field()
		title = name
		if title_field and title_field != "name":
			title = frappe.db.get_value(doctype, name, title_field) or name
		title = str(title)
		return {
			"key": f"Form/{doctype}/{name}",
			"type": "Form",
			"doctype": doctype,
			"name": name,
			"title": title,
			"subtitle": _(doctype) if title == name else f"{_(doctype)} · {name}",
		}
	except Exception:
		return None


def _route_item(route):
	parts = (route or "").split("/")
	kind = parts[0] if parts else ""
	try:
		if kind == "List" and len(parts) >= 2:
			doctype = parts[1]
			if not frappe.db.exists("DocType", doctype) or not frappe.has_permission(doctype, "read"):
				return None
			return {"key": f"List/{doctype}", "type": "List", "doctype": doctype, "title": _(doctype), "subtitle": _("List")}
		if kind == "query-report" and len(parts) >= 2:
			report = parts[1]
			if not frappe.db.exists("Report", report) or not frappe.get_doc("Report", report).is_permitted():
				return None
			return {"key": f"Report/{report}", "type": "Report", "name": report, "title": _(report), "subtitle": _("Report")}
	except Exception:
		return None
	return None
