import frappe
from frappe import _
from frappe.utils import add_days, cint, get_datetime, now_datetime

APPROVED_KEYWORDS = {"approved", "accepted", "completed", "paid", "posted", "finished", "verified"}
PENDING_KEYWORDS = {"pending", "awaiting approval", "awaiting", "review", "under review", "in review", "queued", "open"}

@frappe.whitelist()
def get_dashboard_data():
	"""
	Fetch executive dashboard data for KPI counters, recent activities,
	user-specific recent documents, and tasks list.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("You must be logged in to view dashboard metrics."), frappe.PermissionError)

	user = frappe.session.user
	cache_key = f"trevo:desk_dashboard_data:{user}"
	cached = frappe.cache().get_value(cache_key)
	if cached:
		return cached

	now = now_datetime()
	cutoff = add_days(now.date(), -30)

	# 1. Fetch ToDos
	todos = frappe.get_all(
		"ToDo",
		filters={
			"allocated_to": user,
			"status": ["not in", ["Closed", "Cancelled"]],
		},
		fields=["name", "description", "reference_type", "reference_name", "priority", "status", "date"],
		order_by="date asc, modified desc",
		limit_page_length=8
	)

	# 2. Fetch Notifications
	unread_notifications = frappe.db.count(
		"Notification Log",
		{"for_user": user, "read": 0}
	)

	# 3. Recent Activity Log
	recent_activity = frappe.get_all(
		"Activity Log",
		filters={"user": user, "creation": [">=", cutoff]},
		fields=["subject", "operation", "reference_doctype", "reference_name", "creation"],
		order_by="creation desc",
		limit_page_length=6
	)

	# 4. Recent Documents across Transactional Types
	candidate_doctypes = ["Sales Order", "Purchase Order", "Sales Invoice", "Purchase Invoice", "Task"]
	recent_documents = []

	for dt in candidate_doctypes:
		if not frappe.db.exists("DocType", dt) or not frappe.has_permission(dt, "read"):
			continue

		meta = frappe.get_meta(dt)
		fields = ["name", "modified", "owner"]
		if meta.has_field("workflow_state"):
			fields.append("workflow_state")
		if meta.has_field("status"):
			fields.append("status")
		if "docstatus" in meta.get_valid_columns():
			fields.append("docstatus")

		try:
			rows = frappe.get_list(
				dt,
				filters={
					"owner": user,
					"modified": [">=", cutoff],
				},
				fields=fields,
				order_by="modified desc",
				limit_page_length=3
			)
		except Exception:
			continue

		for row in rows:
			status_label = _get_status_label(row)
			recent_documents.append({
				"doctype": dt,
				"name": row.get("name"),
				"modified": row.get("modified"),
				"status_label": status_label,
				"status_tone": _status_tone(status_label),
				"route": f"/app/{dt.lower().replace(' ', '-')}/{row.get('name')}"
			})

	# Sort combined recent documents by modification date descending
	recent_documents.sort(key=lambda doc: get_datetime(doc["modified"]), reverse=True)
	recent_documents = recent_documents[:6]

	# 5. Summarize Metrics
	draft_count = sum(1 for doc in recent_documents if doc.get("status_label") == "Draft")
	approved_count = sum(1 for doc in recent_documents if doc.get("status_label").lower() in APPROVED_KEYWORDS)
	pending_count = sum(1 for doc in recent_documents if doc.get("status_label").lower() in PENDING_KEYWORDS)

	overdue_tasks = sum(
		1 for todo in todos
		if todo.get("date") and get_datetime(todo.get("date")).date() < now.date()
	)

	payload = {
		"stats": {
			"open_tasks": len(todos),
			"overdue_tasks": overdue_tasks,
			"unread_notifications": unread_notifications,
			"draft_documents": draft_count,
			"approved_documents": approved_count,
			"pending_documents": pending_count
		},
		"tasks": todos,
		"recent_activity": recent_activity,
		"recent_documents": recent_documents
	}

	frappe.cache().set_value(cache_key, payload, expires_in_sec=60)
	return payload


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
