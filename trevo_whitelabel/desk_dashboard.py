import frappe
from frappe import _
from frappe.utils import add_days, cint, get_datetime, now_datetime


APPROVED_KEYWORDS = {
	"approved",
	"accepted",
	"completed",
	"paid",
	"posted",
	"finished",
	"verified",
}

PENDING_KEYWORDS = {
	"pending",
	"awaiting approval",
	"awaiting",
	"review",
	"under review",
	"in review",
	"queued",
	"open",
}

FALLBACK_DOCTYPES = (
	"Sales Order",
	"Purchase Order",
	"Material Request",
	"Leave Application",
	"Expense Claim",
	"Purchase Invoice",
	"Sales Invoice",
	"Task",
)


@frappe.whitelist()
def get_desk_dashboard_data():
	if frappe.session.user == "Guest":
		frappe.throw(_("You need to be logged in to view the dashboard."))

	user = frappe.session.user
	cache_key = f"trevo:desk-dashboard:{user}"
	cached = frappe.cache().get_value(cache_key)
	if cached:
		return cached

	now = now_datetime()
	cutoff = add_days(now.date(), -60)

	todos = frappe.get_all(
		"ToDo",
		filters={
			"allocated_to": user,
			"status": ["not in", ["Closed", "Cancelled"]],
		},
		fields=["name", "description", "reference_type", "reference_name", "priority", "status", "date"],
		order_by="date asc, modified desc",
		limit_page_length=6,
	)

	unread_notifications = frappe.db.count(
		"Notification Log",
		{"for_user": user, "read": 0},
	)

	recent_activity = frappe.get_all(
		"Activity Log",
		filters={"user": user, "creation": [">=", cutoff]},
		fields=["subject", "operation", "reference_doctype", "reference_name", "creation"],
		order_by="creation desc",
		limit_page_length=8,
	)

	candidate_doctypes = _get_candidate_doctypes(recent_activity)
	recent_documents = _get_recent_documents(candidate_doctypes, user, cutoff)
	document_stats = _summarize_documents(recent_documents)

	workspaces = _get_workspace_shortcuts()

	payload = {
		"user": _get_user_details(user),
		"stats": {
			"open_tasks": len(todos),
			"overdue_tasks": sum(1 for todo in todos if _is_overdue(todo.get("date"), now)),
			"unread_notifications": unread_notifications,
			"draft_documents": document_stats["draft"],
			"submitted_documents": document_stats["submitted"],
			"approved_documents": document_stats["approved"],
			"pending_documents": document_stats["pending"],
		},
		"tasks": [_serialize_todo(todo, now) for todo in todos],
		"recent_activity": [_serialize_activity(row) for row in recent_activity],
		"recent_documents": recent_documents[:8],
		"workspaces": workspaces,
		"quick_actions": [
			{"label": _("New Task"), "action": "route", "route": "/app/list/todo"},
			{"label": _("My Tasks"), "action": "route", "route": "/app/list/todo"},
			{"label": _("Notifications"), "action": "route", "route": "/app/list/notification-log"},
			{"label": _("Activity Log"), "action": "route", "route": "/app/list/activity-log"},
		],
	}

	frappe.cache().set_value(cache_key, payload, expires_in_sec=60)
	return payload


def _get_user_details(user):
	full_name = frappe.utils.get_fullname(user) or user
	return {
		"id": user,
		"full_name": full_name,
		"first_name": full_name.split(" ", 1)[0] if full_name else user,
		"roles": frappe.get_roles(user),
	}


def _get_candidate_doctypes(recent_activity):
	doctypes = []
	seen = set()

	for row in recent_activity:
		doctype = row.get("reference_doctype")
		if not doctype or doctype in seen:
			continue
		seen.add(doctype)
		doctypes.append(doctype)

	for doctype in FALLBACK_DOCTYPES:
		if doctype not in seen:
			doctypes.append(doctype)

	return doctypes[:8]


def _get_recent_documents(doctypes, user, cutoff):
	documents = []

	for doctype in doctypes:
		if not frappe.db.exists("DocType", doctype):
			continue

		meta = frappe.get_meta(doctype)
		if meta.issingle or meta.istable:
			continue

		fields = ["name", "modified", "owner"]
		if meta.has_field("workflow_state"):
			fields.append("workflow_state")
		if meta.has_field("status"):
			fields.append("status")
		if "docstatus" in meta.get_valid_columns():
			fields.append("docstatus")

		try:
			rows = frappe.get_list(
				doctype,
				filters={
					"owner": user,
					"modified": [">=", cutoff],
				},
				fields=fields,
				order_by="modified desc",
				limit_page_length=4,
			)
		except Exception:
			continue

		for row in rows:
			status_label = _get_status_label(row)
			documents.append(
				{
					"doctype": doctype,
					"name": row.get("name"),
					"modified": row.get("modified"),
					"status_label": status_label,
					"status_tone": _status_tone(status_label),
					"route": ["Form", doctype, row.get("name")],
				}
			)

	documents.sort(key=lambda row: get_datetime(row["modified"]), reverse=True)
	return documents


def _summarize_documents(documents):
	summary = {
		"draft": 0,
		"submitted": 0,
		"approved": 0,
		"pending": 0,
	}

	for row in documents:
		label = (row.get("status_label") or "").strip().lower()
		if label == "draft":
			summary["draft"] += 1
		if label == "submitted":
			summary["submitted"] += 1
		if label in APPROVED_KEYWORDS:
			summary["approved"] += 1
		if label in PENDING_KEYWORDS:
			summary["pending"] += 1

	return summary


def _get_workspace_shortcuts():
	try:
		workspaces = frappe.get_all(
			"Workspace",
			filters={"public": 1, "is_hidden": 0},
			fields=["name", "title", "icon", "label", "module", "parent_page"],
			order_by="sequence_id asc, modified desc",
			limit_page_length=24,
		)
	except Exception:
		workspaces = []

	shortcuts = []
	for workspace in workspaces:
		title = workspace.title or workspace.label or workspace.name
		shortcuts.append(
			{
				"name": workspace.name,
				"title": title,
				"icon": workspace.icon or "Grid",
				"module": workspace.module,
				"parent_page": workspace.parent_page,
				"route": f"/app/{workspace.name.lower().replace(' ', '-')}",
			}
		)

	return shortcuts


def _get_status_label(row):
	workflow_state = (row.get("workflow_state") or "").strip()
	if workflow_state:
		return workflow_state

	status = (row.get("status") or "").strip()
	if status:
		return status

	docstatus = cint(row.get("docstatus"))
	if docstatus == 1:
		return "Submitted"
	if docstatus == 2:
		return "Cancelled"
	return "Draft"


def _status_tone(label):
	value = (label or "").strip().lower()
	if value in APPROVED_KEYWORDS:
		return "success"
	if value in {"cancelled", "rejected", "overdue"}:
		return "danger"
	if value in PENDING_KEYWORDS or value == "submitted":
		return "warning"
	return "neutral"


def _serialize_todo(todo, now):
	description = (todo.get("description") or "").strip()
	title = description or todo.get("reference_name") or todo.get("name")
	return {
		"name": todo.get("name"),
		"title": title,
		"reference_type": todo.get("reference_type"),
		"reference_name": todo.get("reference_name"),
		"priority": todo.get("priority") or "Medium",
		"status": todo.get("status"),
		"date": todo.get("date"),
		"overdue": _is_overdue(todo.get("date"), now),
		"route": ["Form", "ToDo", todo.get("name")],
	}


def _serialize_activity(row):
	subject = (row.get("subject") or "").strip()
	operation = (row.get("operation") or "").strip()
	label = subject or operation or _("Updated record")
	return {
		"label": label,
		"operation": operation,
		"reference_doctype": row.get("reference_doctype"),
		"reference_name": row.get("reference_name"),
		"creation": row.get("creation"),
		"route": (
			["Form", row.get("reference_doctype"), row.get("reference_name")]
			if row.get("reference_doctype") and row.get("reference_name")
			else None
		),
	}


def _get_workspace_shortcuts():
	workspaces = []

	try:
		rows = frappe.get_list(
			"Workspace",
			fields=["name", "title", "label", "icon", "module"],
			order_by="sequence_id asc, modified desc",
			limit_page_length=6,
		)
	except Exception:
		rows = []

	for row in rows:
		title = row.get("title") or row.get("label") or row.get("name")
		workspaces.append(
			{
				"name": row.get("name"),
				"title": title,
				"module": row.get("module"),
				"icon": row.get("icon"),
				"route": ["workspace", row.get("name")],
			}
		)

	return workspaces


def _is_overdue(date_value, now):
	if not date_value:
		return False
	return get_datetime(date_value).date() < now.date()
