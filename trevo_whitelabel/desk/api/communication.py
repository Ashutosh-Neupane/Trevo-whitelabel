import frappe
from frappe.utils import validate_csrf_token
from frappe import _

@frappe.whitelist()
def get_recent_messages():
	"""Fetch the last 20 chat messages for the docked chat component."""
	# CSRF protection for GET (optional) – ensure token if present
	csrf_token = frappe.form_dict.get('csrf_token')
	if csrf_token:
		validate_csrf_token(csrf_token)
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to load chat messages."), frappe.PermissionError)

	# Fetch recent comments categorized as general Comment
	comments = frappe.get_all(
		"Comment",
		filters={"comment_type": "Comment", "reference_doctype": "User"},
		fields=["name", "comment_email", "comment_by", "content", "creation"],
		order_by="creation desc",
		limit_page_length=20
	)
	
	# Reverse to restore chronological order
	comments.reverse()
	return comments


@frappe.whitelist()
def send_chat_message(content):
	"""Post a new chat message and broadcast it in real-time to all connected users."""
	# CSRF protection for POST
	csrf_token = frappe.form_dict.get('csrf_token')
	if csrf_token:
		validate_csrf_token(csrf_token)
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to send chat messages."), frappe.PermissionError)

	if not content or not str(content).strip():
		frappe.throw(_("Chat message content cannot be empty."))

	# Create a Comment record referenced to the User doctype
	doc = frappe.get_doc({
		"doctype": "Comment",
		"comment_type": "Comment",
		"reference_doctype": "User",
		"reference_name": frappe.session.user,
		"comment_email": frappe.session.user,
		"comment_by": frappe.utils.get_fullname(frappe.session.user) or frappe.session.user,
		"content": content.strip()
	})
	doc.insert(ignore_permissions=True)

	# Package message payload
	message_payload = {
		"name": doc.name,
		"comment_by": doc.comment_by,
		"comment_email": doc.comment_email,
		"content": doc.content,
		"creation": frappe.utils.datetime.datetime.strftime(doc.creation, "%Y-%m-%d %H:%M:%S")
	}

	# Broadcast to all logged-in users via WebSockets
	frappe.publish_realtime(
		event="trevo_chat_message",
		message=message_payload,
		after_commit=True
	)

	return message_payload
