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
	opened_rows = frappe.parse_json(opened) or []
	return {
		"approvals": get_approvals(),
		"assigned": get_assigned(),
		"usage": get_usage(opened_rows),
		"kpis": get_kpi_groups(),
		"recent": get_recent(opened_rows),
		"modules": get_usable_modules(readable),
		"doctype_modules": get_doctype_modules(),
		"custom": get_custom_doctypes(readable),
		"create_config": get_create_config(),
	}


def get_create_config():
	"""Create buttons chosen in Trevo Settings > Home, in order, with each DocType's module.
	Empty when the site has not chosen any (the home then uses each module's own DocTypes)."""
	return frappe.get_all(
		"Trevo Home Create",
		filters={"parent": "Trevo Settings", "parenttype": "Trevo Settings"},
		fields=["document_type as doctype", "module"],
		order_by="idx asc",
	)


def _insights_available():
	"""Frappe Insights (BI app, /insights) is installed and the user may read its dashboards.
	The home then links each module tab to it for deeper analysis; the cards and charts on the
	home itself are Frappe widgets, which Insights renders when it has claimed them."""
	if "insights" not in frappe.get_installed_apps():
		return False
	for doctype in ("Insights Dashboard v3", "Insights Dashboard"):
		if frappe.db.exists("DocType", doctype):
			return bool(frappe.has_permission(doctype, "read"))
	return False


def _module_dashboard(module):
	"""The module's full Frappe Dashboard (/desk/dashboard-view/<name>) the user may open:
	the one named like the module first ("Accounts" over "Payments")."""
	names = frappe.get_all("Dashboard", filters={"module": module}, pluck="name", order_by="name asc")
	names.sort(key=lambda n: n != module)
	for name in names:
		if frappe.has_permission("Dashboard", doc=name):
			return name
	return None


APPROVAL_SCAN = 30  # documents read per workflow
APPROVAL_LIMIT = 8  # shown on the home


def get_approvals():
	"""Documents waiting for this user's workflow action, oldest first.

	For every active Workflow, documents in a state from which one of the user's roles has a
	transition are checked with Frappe's own get_transitions (roles, self-approval rule and
	transition conditions), so an entry appears exactly when the form would offer the user an
	action button. Reads go through frappe.get_list, so User Permissions apply. Independent of
	Workflow Action records, which need a background worker."""
	from frappe.model.workflow import get_transitions

	roles = set(frappe.get_roles())
	user = frappe.session.user
	# Others' documents waiting on the user (approvals) vs. the user's own documents they can
	# move on (e.g. a draft to "Submit for Approval"), shown apart so a draft is not an "approval".
	items, total, mine, mine_total = [], 0, [], 0
	for wf in frappe.get_all(
		"Workflow", filters={"is_active": 1}, fields=["name", "document_type", "workflow_state_field"]
	):
		doctype, state_field = wf.document_type, wf.workflow_state_field
		if not frappe.has_permission(doctype, "read"):
			continue
		states = {
			t.state
			for t in frappe.get_all(
				"Workflow Transition", filters={"parent": wf.name}, fields=["state", "allowed"]
			)
			if t.allowed in roles
		}
		if not states:
			continue
		meta = frappe.get_meta(doctype)
		title_field = meta.get_title_field()
		for row in frappe.get_list(
			doctype,
			filters={state_field: ["in", list(states)], "docstatus": ["<", 2]},
			fields=["name"],
			order_by="modified asc",
			limit=APPROVAL_SCAN,
		):
			try:
				doc = frappe.get_doc(doctype, row.name)
				actions = [t.action for t in get_transitions(doc)]
			except Exception:
				continue
			if not actions:
				continue
			own = doc.owner == user
			if own:
				mine_total += 1
			else:
				total += 1
			target = mine if own else items
			if len(target) >= APPROVAL_LIMIT:
				continue
			title = doc.get(title_field) if title_field and title_field != "name" else None
			target.append(
				{
					"doctype": doctype,
					"name": doc.name,
					"title": str(title or doc.name),
					"state": doc.get(state_field),
					"actions": actions,
					"owner": frappe.utils.get_fullname(doc.owner),
					"waiting_since": doc.modified,
					"amount": _doc_amount(doc),
				}
			)
	items.sort(key=lambda i: i["waiting_since"])
	mine.sort(key=lambda i: i["waiting_since"])
	return {"items": items, "total": total, "mine": mine, "mine_total": mine_total}


def _doc_amount(doc):
	"""Grand total, formatted in the document's currency, when the document has one."""
	for field in ("grand_total", "total_amount", "paid_amount", "total"):
		if doc.meta.has_field(field) and doc.get(field):
			currency = doc.get("currency") or doc.get("paid_from_account_currency")
			return frappe.utils.fmt_money(doc.get(field), currency=currency)
	return None


def get_assigned():
	"""Open assignments (ToDo) for the user, due first, with the document they point at."""
	rows = frappe.get_list(
		"ToDo",
		filters={"allocated_to": frappe.session.user, "status": "Open"},
		fields=["name", "description", "reference_type", "reference_name", "date", "priority"],
		order_by="creation desc",
		limit=20,
	)
	# Due ones first (earliest date), then undated, newest first.
	rows.sort(key=lambda r: (r.date is None, str(r.date or "")))
	items = []
	for row in rows:
		item = {
			"todo": row.name,
			"description": frappe.utils.strip_html(row.description or "")[:140],
			"date": row.date,
			"priority": row.priority,
		}
		if row.reference_type and row.reference_name:
			doc = _doc_item(row.reference_type, row.reference_name)
			if not doc:
				continue
			item.update({"doctype": row.reference_type, "name": row.reference_name, "title": doc["title"]})
		items.append(item)
	return {"items": items[:8], "total": len(items)}


USAGE_DAYS = 90


def get_usage(opened):
	"""How much the user works with each DocType and module lately: edits (Version), list and
	report visits (Route History) and documents opened in this browser. The home orders KPI
	tabs and Create buttons by it, so the page follows the user's own workflow."""
	since = frappe.utils.add_days(frappe.utils.now_datetime(), -USAGE_DAYS)
	score = {}

	for row in frappe.get_all(
		"Version",
		filters={"owner": frappe.session.user, "creation": [">", since]},
		fields=["ref_doctype"],
		limit=500,
	):
		score[row.ref_doctype] = score.get(row.ref_doctype, 0) + 3
	for row in frappe.get_all(
		"Route History",
		filters={"user": frappe.session.user, "creation": [">", since]},
		fields=["route"],
		limit=500,
	):
		parts = (row.route or "").split("/")
		if len(parts) >= 2 and parts[0] == "List":
			score[parts[1]] = score.get(parts[1], 0) + 1
	for row in (opened or [])[:OPENED_LIMIT]:
		if isinstance(row, dict) and row.get("doctype"):
			score[row["doctype"]] = score.get(row["doctype"], 0) + 2

	modules = {}
	if score:
		for dt, module in frappe.get_all(
			"DocType", filters={"name": ["in", list(score)]}, fields=["name", "module"], as_list=True
		):
			modules[module] = modules.get(module, 0) + score[dt]
	return {"doctypes": score, "modules": modules}


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
	insights = _insights_available()
	return [
		{
			"module": module,
			"workspace": workspace_of.get(module),
			"cards": cards,
			"chart": charts.get(module),
			"dashboard": _module_dashboard(module),
			"insights": bool(insights),
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
