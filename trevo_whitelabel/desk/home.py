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
def get_attention():
	"""Only what changes during the day (approvals, assignments, cues, calendar), for the home's
	periodic refresh without redrawing KPIs and modules."""
	usage = get_usage([])
	return {
		"approvals": get_approvals(),
		"assigned": get_assigned(),
		"cues": get_cues(usage.get("modules")),
		"events": get_upcoming_events(),
	}


@frappe.whitelist()
def get_home_data(opened=None):
	readable = set(frappe.get_user().get_can_read())
	base_only = _base_only_readable(readable)
	opened_rows = frappe.parse_json(opened) or []
	usage = get_usage(opened_rows)
	modules = get_usable_modules(readable - base_only)
	kpis = get_kpi_groups()
	if base_only:
		# A module whose KPIs the user can read only through the base roles (Quality for a new
		# hire) is not theirs: show the KPIs of the modules their own roles open.
		kpis = [g for g in kpis if g.get("module") in modules]
	if not kpis:
		# Narrow roles (a delivery driver reads Delivery Note and Delivery Trip, no KPI card)
		# still get a tab per module, so its quick links give the page a working centre.
		kpis = _link_only_groups(modules, usage.get("modules"))
	return {
		"approvals": get_approvals(),
		"assigned": get_assigned(),
		"cues": get_cues(usage.get("modules")),
		"events": get_upcoming_events(),
		"usage": usage,
		"kpis": kpis,
		"recent": get_recent(opened_rows),
		"modules": modules,
		"doctype_modules": get_doctype_modules(),
		"base_only": sorted(base_only),
		"custom": get_custom_doctypes(readable),
		"create_config": get_create_config(),
	}


LINK_ONLY_SKIP = {"Contacts", "Setup", "Core", "Desk"}


def _link_only_groups(modules, usage_modules, limit=4):
	"""KPI groups without cards for a user who has none: their business modules, most used first."""
	business = [m for m in modules if m not in LINK_ONLY_SKIP and frappe.db.exists("Workspace", m)]
	business.sort(key=lambda m: -(usage_modules or {}).get(m, 0))
	groups = []
	for module in business[:limit]:
		groups.append({"module": module, "workspace": module if _workspace_permitted(module) else None,
			"cards": [], "chart": None, "dashboard": None, "insights": False})
	return groups


BASE_ROLES = {"All", "Guest", "Desk User"}


def _base_only_readable(readable):
	"""DocTypes the user can read only because every desk user can (roles All / Desk User).

	ERPNext lets every desk user read some 60 DocTypes: lookups (Country, Gender), their own
	Leads, Projects and Sales Invoices, the Quality lists, the framework's admin lists. Judged
	by those, a new hire got Quality KPIs and Build, Data, Users and Website tiles. Modules and
	KPIs are judged by what the user's own roles grant; System Managers see everything."""
	roles = set(frappe.get_roles()) - BASE_ROLES
	if "System Manager" in roles or frappe.session.user == "Administrator" or not readable:
		return set()
	readable = list(readable)
	with_custom = set(frappe.get_all("Custom DocPerm", filters={"parent": ["in", readable]}, pluck="parent", distinct=True))
	granted = set()
	if roles:
		perm = {"parent": ["in", readable], "role": ["in", list(roles)], "read": 1, "permlevel": 0}
		granted |= set(frappe.get_all("Custom DocPerm", filters=perm, pluck="parent", distinct=True))
		granted |= {d for d in frappe.get_all("DocPerm", filters=perm, pluck="parent", distinct=True) if d not in with_custom}
	return set(readable) - granted


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
		if frappe.has_permission("Dashboard", doc=name) and _dashboard_usable(name):
			return name
	return None


def _dashboard_usable(name):
	"""Every chart and card on the Dashboard can be drawn for this user. Frappe's dashboard
	page shows a chart the user may open but whose report they may not run, and raises a
	permission error on load (e.g. Accounts > Budget Variance for a Purchase User)."""
	charts = frappe.get_all("Dashboard Chart Link", filters={"parent": name, "parenttype": "Dashboard"}, pluck="chart")
	cards = frappe.get_all("Number Card Link", filters={"parent": name, "parenttype": "Dashboard"}, pluck="card")
	return all(_source_permitted("Dashboard Chart", c) for c in charts if c) and all(
		_source_permitted("Number Card", c) for c in cards if c
	)


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


# ── Cues ("In your modules") ──
# Work that ERPNext's own document statuses say is waiting, so that users no workflow involves
# (most of them) still see what needs doing: overdue invoices for accounts, late deliveries for
# stock, leads to follow up for sales, rejected inspections for quality...
#   - Which modules: the user's ERPNext roles ("Stock User" → Stock) plus modules they use a lot.
#   - Whose documents: staff see their own where a document has an owner (a Sales User's own
#     late orders and leads), managers and Accounts see the team's ("scope": "yours" / "team").
#   - Counts go through frappe.get_list, so DocType permissions and User Permissions apply, and
#     a click opens the list with the same filters.
#   - Site-specific cues: Trevo Settings > Home > Attention cues points at any Number Card of
#     type "Document Type"; its filters, module and label are reused.
CUE_SCAN = 500  # documents counted per cue ("500+" beyond)
DRAFT_DOCTYPES = (
	"Quotation", "Sales Order", "Delivery Note", "Sales Invoice", "Payment Entry", "Journal Entry",
	"Material Request", "Purchase Order", "Purchase Receipt", "Purchase Invoice", "Stock Entry",
)
# ERPNext role prefix ("Stock" in "Stock User"/"Stock Manager") → modules whose cues matter to it.
ROLE_MODULES = {
	"Accounts": ["Accounts"], "Sales": ["Selling", "CRM"], "Purchase": ["Buying"], "Stock": ["Stock"],
	"Manufacturing": ["Manufacturing"], "Projects": ["Projects"], "Quality": ["Quality Management"],
	"Support": ["Support"], "Maintenance": ["Support", "Assets"], "Item": ["Stock"], "Delivery": ["Stock"],
	"Auditor": ["Accounts"],  # a role named without a "User"/"Manager" suffix
}
# Holders of these roles see the whole team's documents in that module; others see their own.
MANAGER_ROLES = {
	"Selling": {"Sales Manager", "Sales Master Manager"}, "CRM": {"Sales Manager", "Sales Master Manager"},
	"Buying": {"Purchase Manager", "Purchase Master Manager"}, "Projects": {"Projects Manager"},
	"Support": {"Support Team"},
}
TONE_ORDER = {"danger": 0, "warning": 1, "info": 2, "neutral": 3}


def _cue_definitions():
	today = frappe.utils.today()
	now = frappe.utils.now()
	week = frappe.utils.add_days(today, 7)
	fortnight = frappe.utils.add_days(today, 14)
	month_ago = frappe.utils.add_days(today, -30)
	open_tasks = ["status", "not in", ["Completed", "Cancelled", "Template"]]
	C = lambda key, module, doctype, label, tone, icon, filters, **kw: dict(  # noqa: E731
		key=key, modules=[module] + kw.pop("also", []), doctype=doctype, label=label, tone=tone, icon=icon, filters=filters, **kw)
	return [
		# Accounts: money owed to and by the company, and documents waiting to be billed.
		C("overdue_receivables", "Accounts", "Sales Invoice", _("Overdue customer invoices"), "danger", "receipt-text",
			[["docstatus", "=", 1], ["outstanding_amount", ">", 0], ["due_date", "<", today]], amount="outstanding_amount"),
		C("payables_due", "Accounts", "Purchase Invoice", _("Supplier bills due this week"), "warning", "wallet",
			[["docstatus", "=", 1], ["outstanding_amount", ">", 0], ["due_date", "<=", week]], amount="outstanding_amount"),
		C("to_invoice", "Accounts", "Delivery Note", _("Deliveries to invoice"), "warning", "file-plus",
			[["docstatus", "=", 1], ["status", "=", "To Bill"]], amount="base_grand_total"),
		C("receipts_to_bill", "Accounts", "Purchase Receipt", _("Receipts awaiting the supplier bill"), "info", "file-input",
			[["docstatus", "=", 1], ["status", "=", "To Bill"]], amount="base_grand_total"),
		C("bank_unreconciled", "Accounts", "Bank Transaction", _("Bank transactions to reconcile"), "info", "landmark",
			[["docstatus", "=", 1], ["status", "in", ["Pending", "Unreconciled"]]]),
		# Selling: the salesperson's own pipeline unless they manage the team.
		C("late_deliveries", "Selling", "Sales Order", _("Orders late to deliver"), "danger", "truck",
			[["docstatus", "=", 1], ["status", "in", ["To Deliver and Bill", "To Deliver"]], ["delivery_date", "<", today]],
			amount="base_grand_total", own="owner", also=["Stock"]),
		C("quotes_expiring", "Selling", "Quotation", _("Quotations expiring this week"), "warning", "hourglass",
			[["docstatus", "=", 1], ["status", "=", "Open"], ["valid_till", "between", [today, week]]], amount="base_grand_total", own="owner"),
		C("quotes_open", "Selling", "Quotation", _("Open quotations to follow up"), "info", "message-square-quote",
			[["docstatus", "=", 1], ["status", "=", "Open"]], amount="base_grand_total", own="owner"),
		# CRM: leads nobody has answered, deals about to close.
		C("leads_new", "CRM", "Lead", _("Leads to contact"), "warning", "user-plus",
			[["status", "in", ["Lead", "Open"]]], own="lead_owner"),
		C("opportunities", "CRM", "Opportunity", _("Opportunities closing in 2 weeks"), "info", "target",
			[["status", "in", ["Open", "Replied"]], ["expected_closing", "between", [today, fortnight]]],
			amount="opportunity_amount", own="opportunity_owner"),
		# Buying
		C("requests_to_order", "Buying", "Material Request", _("Material requests to order"), "warning", "clipboard-list",
			[["docstatus", "=", 1], ["material_request_type", "=", "Purchase"], ["status", "in", ["Pending", "Partially Ordered"]]]),
		C("late_receipts", "Buying", "Purchase Order", _("Purchase orders late to arrive"), "danger", "package-x",
			[["docstatus", "=", 1], ["status", "in", ["To Receive and Bill", "To Receive"]], ["schedule_date", "<", today]],
			amount="base_grand_total", own="owner", also=["Stock"]),
		C("supplier_quotes", "Buying", "Supplier Quotation", _("Supplier quotations to compare"), "info", "scale",
			[["docstatus", "=", 1], ["status", "=", "Submitted"]], amount="base_grand_total", own="owner"),
		# Stock
		C("transfers_pending", "Stock", "Material Request", _("Material transfers to make"), "warning", "arrow-left-right",
			[["docstatus", "=", 1], ["material_request_type", "=", "Material Transfer"], ["status", "in", ["Pending", "Partially Received"]]]),
		C("to_deliver_week", "Stock", "Sales Order", _("Orders due to ship this week"), "info", "package",
			[["docstatus", "=", 1], ["status", "in", ["To Deliver and Bill", "To Deliver"]], ["delivery_date", "between", [today, week]]]),
		# Delivery: the trips a driver (Delivery User) has to run, and the ones still on the road.
		C("trips_scheduled", "Stock", "Delivery Trip", _("Delivery trips to run"), "warning", "truck",
			[["docstatus", "=", 1], ["status", "=", "Scheduled"]]),
		C("trips_in_transit", "Stock", "Delivery Trip", _("Delivery trips on the road"), "info", "navigation",
			[["docstatus", "=", 1], ["status", "=", "In Transit"]]),
		# Manufacturing
		C("wo_late", "Manufacturing", "Work Order", _("Work orders past planned end"), "danger", "factory",
			[["docstatus", "=", 1], ["status", "in", ["Not Started", "In Process"]], ["planned_end_date", "<", now]]),
		C("wo_to_start", "Manufacturing", "Work Order", _("Work orders to start"), "info", "play",
			[["docstatus", "=", 1], ["status", "=", "Not Started"]]),
		C("job_cards", "Manufacturing", "Job Card", _("Open job cards"), "info", "wrench",
			[["docstatus", "=", 0], ["status", "in", ["Open", "Work In Progress", "On Hold"]]]),
		# Projects: a team member sees the tasks of their own projects; Projects Managers all.
		C("overdue_tasks", "Projects", "Task", _("Overdue tasks"), "danger", "calendar-x",
			[open_tasks, ["exp_end_date", "<", today]], own="project_member"),
		C("tasks_week", "Projects", "Task", _("Tasks due this week"), "info", "calendar-clock",
			[open_tasks, ["exp_end_date", "between", [today, week]]], own="project_member"),
		# Quality
		C("nc_open", "Quality Management", "Non Conformance", _("Open non-conformances"), "danger", "shield-alert",
			[["status", "=", "Open"]]),
		C("qi_rejected", "Quality Management", "Quality Inspection", _("Inspections rejected (30 days)"), "warning", "circle-x",
			[["docstatus", "=", 1], ["status", "=", "Rejected"], ["report_date", ">=", month_ago]], also=["Stock", "Buying"]),
		C("qa_open", "Quality Management", "Quality Action", _("Corrective actions open"), "warning", "list-todo",
			[["status", "=", "Open"]]),
		C("qr_open", "Quality Management", "Quality Review", _("Quality reviews to complete"), "info", "clipboard-check",
			[["status", "=", "Open"]]),
		# Support
		C("issues_high", "Support", "Issue", _("High-priority tickets open"), "danger", "siren",
			[["status", "=", "Open"], ["priority", "=", "High"]]),
		C("issues_open", "Support", "Issue", _("Open support tickets"), "warning", "life-buoy",
			[["status", "=", "Open"]]),
		C("issues_hold", "Support", "Issue", _("Tickets on hold"), "info", "pause",
			[["status", "=", "On Hold"]]),
		C("warranty_open", "Support", "Warranty Claim", _("Warranty claims open"), "warning", "shield",
			[["status", "in", ["Open", "Work In Progress"]]]),
		# Assets
		C("asset_maintenance", "Assets", "Asset Maintenance Log", _("Asset maintenance due"), "warning", "wrench",
			[["docstatus", "=", 0], ["maintenance_status", "in", ["Planned", "Overdue"]], ["due_date", "<=", week]]),
		C("asset_repairs", "Assets", "Asset Repair", _("Asset repairs pending"), "info", "hammer",
			[["repair_status", "=", "Pending"]]),
	]


def _user_modules(usage_modules):
	"""Modules this user works in: named by their ERPNext roles, plus any they use a lot, less
	the modules their Module Profile blocks. None means "all" (System Manager / Administrator).

	A user with no business role (a new employee with only desk access) gets only the modules
	they use, often none, rather than every module some lookup list happens to be readable in."""
	roles = set(frappe.get_roles())
	if "System Manager" in roles:
		return None
	modules = {
		module for prefix, mods in ROLE_MODULES.items()
		if any(r.startswith(f"{prefix} ") or r == f"{prefix} Team" or r == prefix for r in roles)
		for module in mods
	}
	modules |= {m for m, score in (usage_modules or {}).items() if score >= 6}
	return modules - _blocked_modules()


def _blocked_modules():
	"""Modules the user's Module Profile (or User > Block Modules) hides from them."""
	return set(frappe.get_doc("User", frappe.session.user).get_blocked_modules() or [])


def _sees_team(module, roles):
	return "System Manager" in roles or not MANAGER_ROLES.get(module) or bool(MANAGER_ROLES[module] & roles)


def get_cues(usage_modules=None):
	"""Counts of work waiting in the user's modules.
	Each item: key, module (group), doctype, label, tone, icon, count, more, amount, filters,
	scope ("yours" | "team")."""
	mine = _user_modules(usage_modules)
	blocked = _blocked_modules() if mine is None else set()
	roles = set(frappe.get_roles())
	user = frappe.session.user
	cues = []
	for cue in _cue_definitions() + _settings_cues():
		if mine is None:
			module = next((m for m in cue["modules"] if m not in blocked), None)
			if not module:
				continue
		else:
			module = next((m for m in cue["modules"] if m in mine), None)
			if not module:
				continue
		if not frappe.db.exists("DocType", cue["doctype"]) or not frappe.has_permission(cue["doctype"], "read"):
			continue
		filters = list(cue["filters"])
		scope = "team"
		if cue.get("own") and not _sees_team(module, roles):
			scope = "yours"
			own = cue["own"]
			if own == "project_member":
				# Tasks of the projects the user is a member of (Project > Users).
				projects = frappe.get_all("Project User", filters={"user": user, "parenttype": "Project"}, pluck="parent")
				filters.append(["project", "in", projects or [""]])
			elif own == "_assign":
				filters.append([own, "like", f"%{user}%"])
			else:
				filters.append([own, "=", user])
		amount_field = cue.get("amount")
		try:
			rows = frappe.get_list(cue["doctype"], filters=filters,
				fields=["name"] + ([amount_field] if amount_field else []), limit=CUE_SCAN, order_by="creation desc")
		except (frappe.PermissionError, frappe.db.ProgrammingError, frappe.db.OperationalError):
			continue
		if not rows:
			continue
		cues.append({
			"key": cue["key"], "module": module, "doctype": cue["doctype"], "label": cue["label"], "tone": cue["tone"],
			"icon": cue["icon"], "count": len(rows), "more": len(rows) >= CUE_SCAN, "filters": filters, "scope": scope,
			"amount": sum(frappe.utils.flt(r.get(amount_field)) for r in rows) if amount_field else None,
		})
	# One "Open quotations" line is enough when "expiring this week" is already there, etc.
	keys = {c["key"] for c in cues}
	redundant = {"quotes_open": "quotes_expiring", "issues_open": "issues_high", "wo_to_start": "wo_late"}
	cues = [c for c in cues if not (c["key"] in redundant and redundant[c["key"]] in keys and c["count"] <= 3)]
	cues.sort(key=lambda c: TONE_ORDER.get(c["tone"], 3))
	return {"items": cues + _draft_cues(), "currency": frappe.defaults.get_global_default("currency"),
		"modules": sorted(mine) if mine is not None else None}


def _settings_cues():
	"""Cues an administrator added in Trevo Settings > Home > Attention cues, each pointing at a
	Number Card of type "Document Type" (its filters, label and module are reused)."""
	if not frappe.db.exists("DocType", "Trevo Home Cue"):
		return []
	rows = frappe.get_all("Trevo Home Cue", filters={"parent": "Trevo Settings", "parenttype": "Trevo Settings"},
		fields=["number_card", "label", "tone", "icon"], order_by="idx asc")
	out = []
	for row in rows:
		card = frappe.db.get_value("Number Card", row.number_card,
			["type", "document_type", "filters_json", "label", "module", "function", "aggregate_function_based_on"], as_dict=True)
		if not card or card.type != "Document Type" or not card.document_type:
			continue
		filters = [f[1:4] for f in (frappe.parse_json(card.filters_json or "[]") or []) if len(f) >= 4]
		out.append({
			"key": f"card_{frappe.scrub(row.number_card)}", "modules": [card.module or "Other"], "doctype": card.document_type,
			"label": row.label or card.label, "tone": row.tone or "info", "icon": row.icon or "gauge", "filters": filters,
			"amount": card.aggregate_function_based_on if card.function == "Sum" else None,
		})
	return out


def _draft_cues():
	"""The user's own unsubmitted documents, one cue per DocType (at most three)."""
	out = []
	for doctype in DRAFT_DOCTYPES:
		# Under a workflow a "draft" may be waiting on someone else; the approval cards cover it.
		if not frappe.has_permission(doctype, "read") or frappe.db.exists("Workflow", {"document_type": doctype, "is_active": 1}):
			continue
		filters = [["docstatus", "=", 0], ["owner", "=", frappe.session.user]]
		count = len(frappe.get_list(doctype, filters=filters, pluck="name", limit=CUE_SCAN))
		if count:
			out.append({"key": f"drafts_{frappe.scrub(doctype)}", "module": "_drafts", "doctype": doctype, "tone": "neutral",
				"icon": "file-pen", "label": _(doctype), "count": count, "more": False, "filters": filters, "scope": "yours"})
	out.sort(key=lambda c: -c["count"])
	return out[:3]


def get_upcoming_events():
	"""The user's calendar for the next 7 days (Event permission: own, public or invited)."""
	now = frappe.utils.now_datetime()
	events = frappe.get_list(
		"Event",
		filters=[["starts_on", "between", [now, frappe.utils.add_days(now, 7)]], ["status", "=", "Open"]],
		fields=["name", "subject", "starts_on", "all_day", "color", "event_type", "owner"],
		order_by="starts_on asc",
		limit=20,
	)
	# Public events are everyone's by Frappe's rule, so CRM appointments (public events about a
	# Lead or Customer) filled a delivery driver's and a new hire's "Coming up". Keep a public
	# event someone else made only when the user may read what it is about.
	user = frappe.session.user
	about = {}
	for row in frappe.get_all("Event Participants", filters={"parenttype": "Event", "parent": ["in", [e.name for e in events]]},
			fields=["parent", "reference_doctype"]):
		about.setdefault(row.parent, set()).add(row.reference_doctype)
	kept = [
		e for e in events
		if e.event_type != "Public" or e.owner == user
		or all(dt and frappe.has_permission(dt, "read") for dt in about.get(e.name, ()))
	]
	return [{k: e[k] for k in ("name", "subject", "starts_on", "all_day", "color")} for e in kept[:5]]


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
	"""Modules whose tile the server decides: those that own standard DocTypes, and every module
	the user's Module Profile blocks. The home shows such a tile only when it is in `modules`
	(get_usable_modules, which leaves blocked modules out).

	v16 also has grouping modules (Build, Users, Data, System) that only link to DocTypes
	elsewhere; the home judges those by their links, so a blocked one must be listed here or
	a General Manager blocked from "Data" would still get its tile."""
	owners = frappe.get_all("DocType", filters={"istable": 0, "custom": 0}, pluck="module", distinct=True)
	return sorted(set(owners) | _blocked_modules())


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


KPI_CACHE_SECONDS = 300


def get_kpi_groups():
	"""Which cards and charts this user's home shows, per module (not their values).

	Deciding that runs Frappe's permission check for every card on every workspace: about 700
	queries for a user with every module. The answer only changes with the user's roles, blocked
	modules or language, so it is kept for a few minutes under those. The values are read live by
	Frappe's widgets each time."""
	user = frappe.session.user
	signature = [sorted(frappe.get_roles()), sorted(_blocked_modules()), frappe.local.lang]
	key = f"trevo_kpi_groups::{user}"
	cached = frappe.cache.get_value(key)
	if cached and cached.get("signature") == signature:
		return cached["groups"]
	groups = _build_kpi_groups()
	frappe.cache.set_value(key, {"signature": signature, "groups": groups}, expires_in_sec=KPI_CACHE_SECONDS)
	return groups


def _build_kpi_groups():
	if not frappe.has_permission("Number Card", throw=False):
		return []

	rows = frappe.db.sql(
		"""
		select ws.name as workspace, ws.module as workspace_module, wnc.number_card_name as card,
			wnc.label, nc.module as card_module, nc.is_public, nc.owner, nc.document_type, md.app_name
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
		if not _source_permitted("Number Card", row.card) or _card_frozen(row.card):
			continue
		seen.add(row.card)
		# A card shown on several workspaces ("Annual Sales" on Home and Selling) is filed
		# under its own module when the user can see that module.
		module = row.card_module if row.card_module in visible_modules else row.workspace_module
		groups.setdefault(module, []).append({"name": row.card, "label": _(row.label or row.card), "doctype": row.document_type})

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
			# DocTypes the widgets format values with: the home loads each once, up front.
			"doctypes": sorted({c["doctype"] for c in cards if c.get("doctype")}
				| ({charts[module]["doctype"]} if charts.get(module, {}).get("doctype") else set())),
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
			dc.is_public, dc.owner, dc.document_type, md.app_name
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
		if not frappe.has_permission("Dashboard Chart", doc=row.chart) or not _source_permitted("Dashboard Chart", row.chart):
			continue
		charts[row.module] = {"name": row.chart, "label": _(row.label or row.chart), "doctype": row.document_type}
	return charts


def _source_permitted(widget_doctype, name):
	"""Whether the user can run what a card or chart is drawn from, not only open the widget.

	Frappe's Number Card / Dashboard Chart permission allows a widget whose report the user
	may not run: "Budget Variance" (Accounts) is drawn from the Budget Variance Report, which
	reads Cost Center, so a Purchase User got "You don't have permission to get a report on:
	Cost Center". The home shows a widget only when, as the widget would ask:
	  - report source: the user may open the report (its roles) and run reports on its
	    DocType (query_report checks the "report" right on ref_doctype)
	  - DocType source (counts, sums, group-by): the user may read that DocType"""
	if widget_doctype == "Number Card":
		source = frappe.db.get_value("Number Card", name, ["type", "report_name", "document_type"], as_dict=True)
		is_report = source and source.type == "Report"
	else:
		source = frappe.db.get_value("Dashboard Chart", name, ["chart_type", "report_name", "document_type"], as_dict=True)
		is_report = source and source.chart_type == "Report"
	if not source:
		return False
	if is_report:
		if not source.report_name or not frappe.db.exists("Report", source.report_name):
			return False
		report = frappe.get_doc("Report", source.report_name)
		if not report.is_permitted():
			return False
		return not report.ref_doctype or bool(frappe.has_permission(report.ref_doctype, "report"))
	if source.document_type:
		return bool(frappe.has_permission(source.document_type, "read"))
	return True  # custom source: Frappe's widget permission is all there is to check


FROZEN_AFTER_DAYS = 365


def _card_frozen(name):
	"""A card whose filters pin it to a fixed date window that ended long ago.

	ERPNext ships "Monthly Total Work Order", "Monthly Completed Work Order" and "Monthly Quality
	Inspection" with `creation between 2020-06-08 and 2020-07-08`, so they always read 0. The
	cards are left as ERPNext made them; the home just doesn't offer them. A card with a relative
	window (Timespan, dynamic filters) has no literal dates and is never frozen."""
	import re

	filters = frappe.db.get_value("Number Card", name, "filters_json") or ""
	dates = re.findall(r"\d{4}-\d{2}-\d{2}", filters)
	if not dates:
		return False
	cutoff = frappe.utils.add_days(frappe.utils.today(), -FROZEN_AFTER_DAYS)
	return max(dates) < cutoff


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
