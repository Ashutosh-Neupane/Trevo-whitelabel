import frappe

# The Trevo home Page (trevo_whitelabel/page/trevo_home), opened at /desk.
HOME_PAGE = "trevo-home"
# Removed in Nov 2026: an earlier Trevo dashboard desk Page.
RETIRED_PAGES = ("trevo-dashboard",)
# Frappe's own home; a site on it has not chosen a home page of its own.
FRAPPE_HOME = "desktop"


def use_trevo_home():
	"""Make /desk open the Trevo home Page.

	Frappe reads the "desktop:home_page" default at boot and falls back to its apps screen
	("desktop") when the page is missing or not permitted, so removing this app restores the
	stock home. A home page a site chose for itself is kept.
	"""
	for page in RETIRED_PAGES:
		if frappe.db.exists("Page", page):
			frappe.delete_doc("Page", page, force=True, ignore_permissions=True)

	current = frappe.db.get_default("desktop:home_page")
	if not current or current == FRAPPE_HOME or current in RETIRED_PAGES:
		if frappe.db.exists("Page", HOME_PAGE):
			frappe.db.set_default("desktop:home_page", HOME_PAGE)

	frappe.clear_cache()
