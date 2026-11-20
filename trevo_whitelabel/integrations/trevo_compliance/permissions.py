"""Who may do what with IRD compliance, set up by Trevo when Trevo Compliance is installed.

  Compliance Manager  the company's tax / IRD officer: sets up CBMS, reads the CBMS and query
                      audit logs, runs every IRD register, keeps balance confirmations. Reads
                      invoices and the ledger; never posts them.
  Auditor (ERPNext)   read-only tax review: runs the registers and the VAT return, reads CBMS
                      Logs and balance confirmations. No settings.
  Accounts User       keeps running the registers; also reads CBMS Logs.
  Accounts Manager    as Accounts User; the app already lets them edit CBMS Setting.

Rights go in as Custom DocPerm rows, the record Role Permission Manager writes, so an
administrator can change them there. Each right is granted once and remembered: one taken away
later in Role Permission Manager is not given back on the next migrate.

Reports: REPORT_ROLES offers the registers to Compliance Manager and Auditor as well;
desk/permissions.py then keeps only the roles that can actually run each one.
"""

import json

import frappe
from frappe.permissions import add_permission, update_permission_property

COMPLIANCE_MANAGER = "Compliance Manager"
READ = ["read", "report", "print"]

GRANTS = {
	COMPLIANCE_MANAGER: {
		"CBMS Setting": ["read", "write", "create", "print", "email", "share"],
		"CBMS Logs": ["read", "report", "export", "print", "email"],
		"Query Audit Log": ["read", "report", "export"],
		"Balance Confirmation": ["read", "write", "create", "delete", "report", "export", "print", "email", "share"],
		"Sales Invoice": ["read", "report", "export", "print"],
		"Purchase Invoice": ["read", "report", "export", "print"],
		"GL Entry": ["read", "report", "export"],  # Audit Trial, Balance Confirmation Report
		"Company": ["read"],  # every register defaults its Company filter and reads its PAN
	},
	"Auditor": {"Sales Invoice": READ, "CBMS Logs": READ, "Balance Confirmation": READ},
	"Accounts User": {"CBMS Logs": READ},
}

_REGISTERS = (
	"Sales Register IRD", "Sales Return Register IRD", "Purchase Register IRD", "Purchase Return Register IRD",
	"VAT Return Register", "Sales Cancellation Register", "Item-wise Sales Register IRD",
	"IRD Sales Data Sync Report", "IRD Materialized View Report", "Audit Trial", "Balance Confirmation Report",
	"Sales Register Nepal", "Purchase Register Nepal", "Party-wise Sales Register", "Party-wise Purchase Register",
)
REPORT_ROLES = {
	**{r: [COMPLIANCE_MANAGER, "Auditor"] for r in _REGISTERS},
	"Query Audit Log": [COMPLIANCE_MANAGER],
	"SQL Query Audit Log": [COMPLIANCE_MANAGER],
}

GRANTED_KEY = "trevo_compliance_granted_perms"


def setup_permissions():
	if not frappe.db.exists("Role", COMPLIANCE_MANAGER):
		frappe.get_doc({"doctype": "Role", "role_name": COMPLIANCE_MANAGER, "desk_access": 1}).insert(
			ignore_permissions=True
		)
	granted = set(json.loads(frappe.db.get_default(GRANTED_KEY) or "[]"))
	changed = False
	for role, doctypes in GRANTS.items():
		if not frappe.db.exists("Role", role):
			continue
		for doctype, rights in doctypes.items():
			if not frappe.db.exists("DocType", doctype):
				continue
			for right in rights:
				key = f"{doctype}|{role}|{right}"
				if key in granted:
					continue
				if not _has(doctype, role, right):
					if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0, "if_owner": 0}):
						add_permission(doctype, role, 0)  # copies the standard rows first, as the UI does
					update_permission_property(doctype, role, 0, right, 1)
				granted.add(key)
				changed = True
	if changed:
		frappe.db.set_default(GRANTED_KEY, json.dumps(sorted(granted)))
		frappe.clear_cache()


def _has(doctype, role, right):
	table = "Custom DocPerm" if frappe.db.exists("Custom DocPerm", {"parent": doctype}) else "DocPerm"
	return bool(frappe.db.exists(table, {"parent": doctype, "role": role, "permlevel": 0, "if_owner": 0, right: 1}))


def check_report_access(report_name):
	"""The same check as opening the report: its roles (with any Custom Role) and report access
	on its DocType. Used by the dashboard numbers, which come from those reports."""
	report = frappe.get_cached_doc("Report", report_name)
	if not report.is_permitted():
		frappe.throw(frappe._("You are not allowed to run {0}").format(frappe._(report_name)), frappe.PermissionError)
	if report.ref_doctype:
		frappe.has_permission(report.ref_doctype, "report", throw=True)
