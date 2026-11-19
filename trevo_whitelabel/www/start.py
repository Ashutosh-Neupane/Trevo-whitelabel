"""Where a person lands: /, /index and Trevo sign-in all come here (/start).

/ and /index used to redirect everyone to /desk. Desk users belong there, but a customer
or supplier (a Website User) cannot open the desk, so after signing in they met
"Not Permitted". Send each person to the home Frappe would give them:
  - not signed in: the Trevo sign-in page
  - desk (System) users: /desk
  - portal users: their role's home page, the Portal Settings default, or /portal
"""

import frappe
from frappe.website.utils import get_home_page_via_hooks, is_portal_user

no_cache = 1


def get_context(context):
	frappe.local.flags.redirect_location = landing_page()
	raise frappe.Redirect


def landing_page():
	user = frappe.session.user
	if user == "Guest":
		return "/signin"
	if frappe.get_cached_value("User", user, "user_type") == "System User":
		return "/desk"

	home = None
	for role in frappe.get_roles(user):
		home = frappe.db.get_value("Role", role, "home_page")
		if home:
			break
	home = home or frappe.db.get_single_value("Portal Settings", "default_portal_home")
	home = home or get_home_page_via_hooks()
	home = (home or "me").strip("/")
	# These would send the visitor back here or into the desk.
	if home in ("", "index", "start", "desk", "app"):
		home = "me"
	# As Frappe does: a customer or supplier starts at their portal (orders, invoices...),
	# not at account settings.
	if home == "me" and is_portal_user():
		home = "portal"
	return f"/{home}"
