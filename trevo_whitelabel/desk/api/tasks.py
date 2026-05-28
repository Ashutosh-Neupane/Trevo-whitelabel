import frappe
from frappe.utils import validate_csrf_token
from frappe import _

@frappe.whitelist()
def get_user_tasks():
	"""Fetch all uncompleted tasks allocated to the active user."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to fetch tasks."), frappe.PermissionError)

	return frappe.get_all(
		"ToDo",
		filters={
			"allocated_to": frappe.session.user,
			"status": ["not in", ["Closed", "Cancelled"]]
		},
		fields=["name", "description", "priority", "date", "status"],
		order_by="date asc, modified desc"
	)


@frappe.whitelist()
def create_user_task(description, priority="Medium", date=None):
    # CSRF protection for POST request
    csrf_token = frappe.form_dict.get('csrf_token')
    if csrf_token:
        validate_csrf_token(csrf_token)
	"""Create a new task (ToDo) for the logged-in user."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to create tasks."), frappe.PermissionError)

	if not description or not str(description).strip():
		frappe.throw(_("Task description cannot be empty."))

	todo = frappe.get_doc({
		"doctype": "ToDo",
		"description": description.strip(),
		"priority": priority or "Medium",
		"date": date,
		"allocated_to": frappe.session.user,
		"status": "Open"
	})
	todo.insert(ignore_permissions=True)

	# Invalidate dashboard cache
	frappe.cache().delete_value(f"trevo:desk_dashboard_data:{frappe.session.user}")
	return {
		"name": todo.name,
		"description": todo.description,
		"priority": todo.priority,
		"date": todo.date,
		"status": todo.status
	}


@frappe.whitelist()
def toggle_task(name, status):
    # CSRF protection for POST request
    csrf_token = frappe.form_dict.get('csrf_token')
    if csrf_token:
        validate_csrf_token(csrf_token)
	"""Toggle a task's status between Open and Closed."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to update tasks."), frappe.PermissionError)

	if not name:
		frappe.throw(_("Task name is required."))

	if not frappe.db.exists("ToDo", name):
		frappe.throw(_("Task not found."), frappe.DoesNotExistError)

	todo = frappe.get_doc("ToDo", name)
	if todo.allocated_to != frappe.session.user:
		frappe.throw(_("You are not authorized to update this task."), frappe.PermissionError)

	todo.status = "Closed" if status == "Closed" else "Open"
	todo.save(ignore_permissions=True)

	# Invalidate dashboard cache
	frappe.cache().delete_value(f"trevo:desk_dashboard_data:{frappe.session.user}")
	return {
		"name": todo.name,
		"status": todo.status
	}
