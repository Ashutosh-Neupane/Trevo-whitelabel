import frappe

def get_context(context):
	"""
	Web view context handler for the root '/' page.
	Automatically redirects all authenticated and guest visitors to the '/desk' command center.
	"""
	frappe.local.flags.redirect_location = "/desk"
	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = "/desk"
	return context
