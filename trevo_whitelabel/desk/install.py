import frappe

DASHBOARD_PAGE = "trevo-dashboard"


def use_default_desk_home():
	"""Let /desk open Frappe's own home again.

	An earlier version pointed the "desktop:home_page" default at the Trevo dashboard.
	Undo that if it is still set; the dashboard stays available at /desk/trevo-dashboard.
	"""
	if frappe.db.get_default("desktop:home_page") == DASHBOARD_PAGE:
		frappe.db.delete("DefaultValue", {"defkey": "desktop:home_page", "defvalue": DASHBOARD_PAGE})
		frappe.clear_cache()
