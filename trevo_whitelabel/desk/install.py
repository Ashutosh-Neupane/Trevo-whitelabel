import frappe

HOME_PAGE = "trevo-dashboard"


def set_home_page():
	"""Open the Trevo dashboard Page when a user lands on /desk.

	Frappe v16 reads the desk home from the "desktop:home_page" default
	(frappe.boot.add_home_page) and falls back to "desktop" if the page is missing,
	so this never blocks the desk. The page itself is a standard Page (JSON) synced by migrate.
	"""
	if frappe.db.exists("Page", HOME_PAGE):
		frappe.db.set_default("desktop:home_page", HOME_PAGE)
