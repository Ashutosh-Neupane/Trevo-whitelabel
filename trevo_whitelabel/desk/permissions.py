"""Keep ERPNext's reports and charts consistent with what each role may read.

ERPNext ships a few mismatches between who is offered a report or chart and who may run it.
The user sees a link, opens it, and gets "You don't have permission to get a report on ..." or
"Insufficient Permission for ...". Two fixes, both through records the desk's own permission
screens write, so ERPNext's code and metadata stay untouched:

1. `narrow_report_roles` - a report is only offered to roles that can run it.
   A report runs only for someone with report access on its ref DocType (and read on any
   DocType its default filters query). Where ERPNext lists a role that lacks that, or lists no
   role at all, a Custom Role (Role Permission for Page and Report) restricts the report to the
   roles that can run it. The sidebar, dashboards, charts and number cards all follow the report's
   allowed roles, so the link disappears instead of failing. Examples:
     - Budget Variance Report is listed for Sales/Purchase User, who cannot report on Cost Center.
     - Job Card Summary / Quality Inspection Summary are listed for Stock User.
     - Accounts Payable is listed for Purchase User but reads Journal Entry.
     - Maintenance Schedules lists no role, so every desk user sees it.

2. `grant_lookup_read` - read on small settings lists that a report or chart is meant to show
   to a role, but reads in a way that role may not:
     - Profit and Loss, Balance Sheet, ... (financial_statements.js) list Accounting Dimensions.
     - Accounts Receivable / Payable list Party Types.
     - The "Warehouse wise Stock Value" chart (roles include Accounts User) sums Bin.
     - The Issue form reads Support Settings; the Chart of Accounts tree reads Accounts Settings.
   Each role offered one of those widgets gets read (no write, no report) through Custom DocPerm,
   the record Role Permission Manager writes.

Both run after install and every migrate, so roles ERPNext adds later are picked up.
"""

import json

import frappe
from frappe.permissions import add_permission, update_permission_property

# DocTypes a report reads beyond its ref DocType when opened with its default filters.
REPORT_READS = {
	"Sales Analytics": ["Sales Invoice"],  # default "Based On" is Sales Invoice
	"Accounts Payable": ["Journal Entry"],  # invoices booked via Journal Entry (frappe.get_list)
	"Accounts Payable Summary": ["Journal Entry"],
	"Accounts Receivable": ["Journal Entry"],
	"Accounts Receivable Summary": ["Journal Entry"],
	"Trial Balance for Party": ["Customer"],  # default Party Type is Customer
}

# Lookup DocType -> widgets that read it in a way their roles may not.
LOOKUPS = {
	"Accounting Dimension": [("Report", r) for r in (
		"Profit and Loss Statement", "Balance Sheet", "Cash Flow", "Consolidated Financial Statement",
		"Dimension-wise Accounts Balance Report", "Custom Financial Statement",
	)],
	"Party Type": [("Report", r) for r in (
		"Accounts Receivable", "Accounts Receivable Summary", "Accounts Payable", "Accounts Payable Summary",
		"Consolidated Accounts Receivable", "Consolidated Accounts Receivable Summary",
		"Consolidated Accounts Payable", "Consolidated Accounts Payable Summary",
	)],
	"Bin": [("Dashboard Chart", "Warehouse wise Stock Value")],
	# The ledger and statement reports default their Company filter and read the company's
	# currency and fiscal settings; the Auditor role may run them but not read Company.
	"Company": [("Report", r) for r in (
		"General Ledger", "Trial Balance", "Profit and Loss Statement", "Balance Sheet", "Cash Flow",
		"Consolidated Financial Statement", "Profitability Analysis", "Accounts Payable", "Budget Variance Report",
	)],
	# Settings a form or tree reads on load (frappe.client.get_value / get_single_value).
	"Support Settings": [("DocType", "Issue")],  # issue.js: SLA tracking switch
	"Accounts Settings": [("DocType", "Account")],  # account_tree.js
}

SKIP_ROLES = {"Administrator", "Guest", "All", "Desk User"}
ADMIN_ROLES = {"Administrator", "System Manager"}
MANAGED_KEY = "trevo_managed_report_roles"  # reports whose Custom Role this module wrote


def apply():
	narrow_report_roles()
	grant_lookup_read()


def narrow_report_roles():
	managed = set(json.loads(frappe.db.get_default(MANAGED_KEY) or "[]"))
	roles = [r for r in frappe.get_all("Role", filters={"disabled": 0}, pluck="name") if r not in ("Administrator", "Guest")]
	cache = {}

	def can(doctype, role, ptype):
		key = (doctype, role, ptype)
		if key not in cache:
			cache[key] = _role_can(doctype, role, ptype)
		return cache[key]

	for report in frappe.get_all("Report", filters={"disabled": 0}, fields=["name", "ref_doctype"]):
		if not report.ref_doctype or not frappe.db.exists("DocType", report.ref_doctype):
			continue
		existing = frappe.db.get_value("Custom Role", {"report": report.name}, "name")
		if existing and report.name not in managed:
			continue  # someone set this report's roles by hand; leave them

		listed = frappe.get_all("Has Role", filters={"parenttype": "Report", "parent": report.name}, pluck="role")
		needs = [d for d in REPORT_READS.get(report.name, []) if frappe.db.exists("DocType", d)]

		def runs(role):
			return can(report.ref_doctype, role, "report") and all(can(d, role, "read") for d in needs)

		if listed:
			# Administrator and System Manager keep what ERPNext gave them (admins hold every role).
			allowed = sorted(r for r in listed if r in ADMIN_ROLES or runs(r))
			wanted = allowed if len(allowed) < len(listed) else None
		else:
			# No role listed means every desk user. Keep it that way only if every user can run it.
			wanted = None if runs("All") or runs("Desk User") else sorted(r for r in roles if runs(r))

		if wanted is not None and not wanted:
			wanted = ["System Manager"]  # nobody else can run it; Custom Role needs at least one row
		_set_custom_role(report, existing, wanted, managed)

	frappe.db.set_default(MANAGED_KEY, json.dumps(sorted(managed)))
	frappe.clear_cache()


def _set_custom_role(report, existing, wanted, managed):
	if wanted is None:
		if existing:
			frappe.delete_doc("Custom Role", existing, ignore_permissions=True)
		managed.discard(report.name)
		return
	doc = frappe.get_doc("Custom Role", existing) if existing else frappe.new_doc("Custom Role")
	if existing and sorted(r.role for r in doc.roles) == wanted:
		managed.add(report.name)
		return
	doc.report = report.name
	doc.ref_doctype = report.ref_doctype
	doc.set("roles", [{"role": r} for r in wanted])
	doc.save(ignore_permissions=True)
	managed.add(report.name)


def grant_lookup_read():
	for doctype, widgets in LOOKUPS.items():
		if not frappe.db.exists("DocType", doctype):
			continue
		roles = set()
		for parenttype, name in widgets:
			if frappe.db.exists(parenttype, name):
				roles |= set(_widget_roles(parenttype, name))
		for role in sorted(roles - SKIP_ROLES):
			if _role_can(doctype, role, "read"):
				continue
			add_permission(doctype, role, 0)  # creates the role's level-0 row (Custom DocPerm)
			update_permission_property(doctype, role, 0, "read", 1)
	frappe.clear_cache()


def _widget_roles(parenttype, name):
	if parenttype == "DocType":  # every role that may read the DocType whose form reads the lookup
		roles = frappe.get_all("Role", filters={"disabled": 0, "desk_access": 1}, pluck="name")
		return [r for r in roles if r not in SKIP_ROLES and _role_can(name, r, "read")]
	if parenttype == "Report":
		custom = frappe.db.get_value("Custom Role", {"report": name}, "name")
		if custom:  # the roles the report is actually offered to
			return frappe.get_all("Has Role", filters={"parenttype": "Custom Role", "parent": custom}, pluck="role")
	return frappe.get_all("Has Role", filters={"parenttype": parenttype, "parent": name}, pluck="role")


def _role_can(doctype, role, ptype):
	"""Whether a desk user holding `role` has `ptype` on `doctype` at level 0.

	Rights add up across a user's roles, and every desk user also holds All and Desk User
	(Desk User grants report on many masters), so those count too. Custom rows replace the
	standard ones for their DocType, as in Role Permission Manager.
	"""
	table = "Custom DocPerm" if frappe.db.exists("Custom DocPerm", {"parent": doctype}) else "DocPerm"
	roles = [role, "All", "Desk User"]
	return bool(frappe.db.exists(table, {"parent": doctype, "role": ["in", roles], "permlevel": 0, ptype: 1}))
