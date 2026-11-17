"""Trevo sign-in page (/signin).

A separate page that signs in through Frappe's standard login API. Frappe's own /login
is left untouched and still handles password reset, two-factor and social login.
"""

import frappe

no_cache = 1

LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"


def get_context(context):
	redirect_to = _safe_redirect(frappe.form_dict.get("redirect-to"))

	if frappe.session.user != "Guest":
		frappe.local.flags.redirect_location = redirect_to
		raise frappe.Redirect

	context.no_cache = 1
	context.redirect_to = redirect_to
	context.logo = LOGO
	context.app_name = "Trevo"
	return context


def _safe_redirect(target):
	"""Only allow paths on this site, so the page cannot be used as an open redirect."""
	if target and target.startswith("/") and not target.startswith("//") and "\\" not in target:
		return target
	return "/desk"
