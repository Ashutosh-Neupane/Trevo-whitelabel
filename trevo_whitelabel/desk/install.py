import frappe

# Removed in Nov 2026: the separate Trevo dashboard desk Page. /desk uses Frappe's own home.
DASHBOARD_PAGE = "trevo-dashboard"


def use_default_desk_home():
	"""Let /desk open Frappe's own home and drop the retired Trevo dashboard Page.

	An earlier version pointed the "desktop:home_page" default at the Trevo dashboard and
	shipped it as a desk Page. Its files are gone; remove what it left in the database.
	"""
	if frappe.db.get_default("desktop:home_page") == DASHBOARD_PAGE:
		frappe.db.delete("DefaultValue", {"defkey": "desktop:home_page", "defvalue": DASHBOARD_PAGE})

	if frappe.db.exists("Page", DASHBOARD_PAGE):
		frappe.delete_doc("Page", DASHBOARD_PAGE, force=True, ignore_permissions=True)

	frappe.clear_cache()
