"""Dashboards, roles and work lists Trevo adds for other apps, when they are installed.

Trevo's desk home shows any installed app on its own (its modules, the cards and charts on its
workspaces). Some apps ship no dashboard of their own; for those, Trevo carries one here so the
app itself stays as its authors ship it. Each integration is a module named after the app, with:

  setup()       idempotent: create or update roles, permissions and dashboard records
  teardown()    remove what setup() made (the app is being uninstalled)
  REPORT_ROLES  {report: [roles]} offered a report beyond the app's own list; desk/permissions.py
                keeps only the roles that can actually run it

It runs after every migrate and when the app is installed or removed, so installing the app on a
site is all it takes for its dashboard to appear on the Trevo home.
"""

import importlib

import frappe

INTEGRATIONS = ("trevo_compliance",)


def _module(app):
	return importlib.import_module(f"trevo_whitelabel.integrations.{app}")


def active():
	"""The integration modules whose app is installed on this site."""
	installed = set(frappe.get_installed_apps())
	return [_module(app) for app in INTEGRATIONS if app in installed]


def sync():
	"""after_migrate: bring every installed app's integration up to date."""
	for integration in active():
		integration.setup()


def after_app_install(app_name):
	if app_name in INTEGRATIONS:
		_module(app_name).setup()
		from trevo_whitelabel.desk.permissions import apply

		apply()


def before_app_uninstall(app_name):
	if app_name in INTEGRATIONS:
		_module(app_name).teardown()


def report_roles():
	"""{report: [roles]} the active integrations offer beyond the reports' own roles."""
	out = {}
	for integration in active():
		for report, roles in getattr(integration, "REPORT_ROLES", {}).items():
			out.setdefault(report, []).extend(roles)
	return out
