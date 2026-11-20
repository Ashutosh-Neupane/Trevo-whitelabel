"""Trevo's dashboard for Trevo Compliance (Nepal IRD: CBMS e-billing, VAT registers).

The compliance app ships its registers and settings but no dashboard. When it is installed this
adds, as ordinary site records (not files of either app, so neither app's migrate removes them):

  - the role "Compliance Manager" and the rights the IRD work needs (permissions.py)
  - number cards, charts and the "Trevo Compliance" dashboard, all in its module, so the Trevo
    home shows them as the module's "At a glance" tab
  - the content of its "Trevo Compliance" workspace: cards, charts, shortcuts, report links

Work lists for "Needs your attention" come from cues.py through the `trevo_home_cues` hook.
"""

import json
import os

import frappe

from trevo_whitelabel.integrations.trevo_compliance.permissions import REPORT_ROLES, setup_permissions

MODULE = "Trevo Compliance"
WORKSPACE = "Trevo Compliance"
DASHBOARD = "Trevo Compliance"
METHODS = "trevo_whitelabel.integrations.trevo_compliance.dashboard"
VIEWERS = ["Compliance Manager", "Auditor", "Accounts User", "Accounts Manager", "System Manager"]

__all__ = ["REPORT_ROLES", "setup", "teardown"]


def _card(name, label, **values):
	return {"name": name, "label": label, **values}


def _custom_card(name, label, method, report, period="This Month"):
	return _card(
		name, label, type="Custom", method=f"{METHODS}.{method}", report_name=report,
		document_type="Sales Invoice", filters_json=json.dumps({"period": period}),
	)


def _doc_card(name, label, filters):
	return _card(
		name, label, type="Document Type", document_type="Sales Invoice", function="Count",
		filters_json=json.dumps([["Sales Invoice", *f, False] for f in filters]),
	)


SENT = ["docstatus", "=", "1"]

# (record name, short label for the home's compact cards)
NUMBER_CARDS = [
	_doc_card("Invoices Not Sent to IRD", "Not sent to IRD", [SENT, ["custom_cbms_status", "is", "not set"]]),
	_doc_card("Failed CBMS Syncs", "Failed CBMS syncs", [SENT, ["custom_cbms_status", "=", "Failed"]]),
	_custom_card("Output VAT This Month", "Output VAT", "output_vat", "VAT Return Register"),
	_custom_card("Input VAT This Month", "Input VAT", "input_vat", "VAT Return Register"),
	_custom_card("Net VAT Last Month", "VAT due, last month", "net_vat", "VAT Return Register", period="Last Month"),
	_custom_card("Credit Notes This Month", "Credit notes", "credit_notes", "Sales Return Register IRD"),
	_custom_card("Cancelled Invoices This Month", "Cancelled", "cancelled_invoices", "Sales Cancellation Register"),
]

# (chart name, Dashboard Chart Source shipped in trevo_whitelabel, chart type, width, report)
CHARTS = [
	("Sales and VAT by BS Month", "IRD Sales by BS Month", "Bar", "Full", "VAT Return Register"),
	("VAT by BS Month", "IRD VAT by BS Month", "Line", "Full", "VAT Return Register"),
	("Invoices by CBMS Status", "IRD CBMS Status", "Donut", "Half", "IRD Sales Data Sync Report"),
	("Sales Mix by BS Month", "IRD Sales Mix by BS Month", "Bar", "Half", "VAT Return Register"),
	("Credit Notes and Cancellations", "IRD Returns by BS Month", "Line", "Half", "Sales Cancellation Register"),
	("Top Customers by VAT", "IRD Top Customers by VAT", "Bar", "Half", "Party-wise Sales Register"),
]


def setup():
	setup_permissions()
	for card in NUMBER_CARDS:
		_upsert("Number Card", card["name"], {
			"label": card["name"], "is_public": 1, "is_standard": 0, "module": MODULE,
			"show_percentage_stats": 0, **{k: v for k, v in card.items() if k not in ("name", "label")},
		})
	for name, source, chart_type, _width, report in CHARTS:
		_upsert("Dashboard Chart", name, {
			"chart_name": name, "chart_type": "Custom", "source": source, "type": chart_type,
			"document_type": "Sales Invoice", "report_name": report, "is_public": 1, "is_standard": 0,
			"module": MODULE, "timeseries": 0, "filters_json": "{}",
			"dynamic_filters_json": json.dumps({"company": 'frappe.defaults.get_user_default("Company")'}),
			"roles": [{"role": r} for r in VIEWERS],
		})
	_upsert("Dashboard", DASHBOARD, {
		"dashboard_name": DASHBOARD, "module": MODULE, "is_standard": 0, "is_default": 0,
		"cards": [{"card": c["name"]} for c in NUMBER_CARDS],
		"charts": [{"chart": name, "width": width} for name, _s, _t, width, _r in CHARTS],
	})
	_fill_workspace()
	frappe.cache.delete_keys("trevo_kpi_groups::")


def teardown():
	for doctype, names in (
		("Dashboard", [DASHBOARD]),
		("Dashboard Chart", [c[0] for c in CHARTS]),
		("Number Card", [c["name"] for c in NUMBER_CARDS]),
	):
		for name in names:
			frappe.delete_doc(doctype, name, ignore_missing=True, force=True, ignore_permissions=True)
	frappe.cache.delete_keys("trevo_kpi_groups::")


def _upsert(doctype, name, values):
	"""Create or update a site record. A record the compliance app once shipped as standard is
	made ordinary first: saving a standard one in developer mode writes it into an app's files."""
	if doctype == "Dashboard Chart" and frappe.db.exists(doctype, name):
		# A chart's type can't change once set (an earlier "Group By" chart of the same name).
		if frappe.db.get_value(doctype, name, "chart_type") != values.get("chart_type"):
			frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
	if frappe.db.exists(doctype, name):
		std = "is_standard"
		if frappe.db.get_value(doctype, name, std):
			frappe.db.set_value(doctype, name, std, 0, update_modified=False)
		doc = frappe.get_doc(doctype, name)
	else:
		doc = frappe.new_doc(doctype)
		doc.name = name
	doc.update(values)
	doc.flags.ignore_permissions = True
	doc.flags.ignore_links = True
	doc.save() if not doc.is_new() else doc.insert(set_name=name)


def _fill_workspace():
	"""The app's own workspace, with Trevo's content. Written straight to the database (no save):
	saving a standard workspace in developer mode would write it into the compliance app's files.
	If the app ships a newer workspace, migrate syncs it and this fills it again right after."""
	if not frappe.db.exists("Workspace", WORKSPACE):
		return
	with open(os.path.join(os.path.dirname(__file__), "workspace.json")) as f:
		layout = json.load(f)
	ws = frappe.get_doc("Workspace", WORKSPACE)
	tables = {
		"number_cards": [{"number_card_name": c["name"], "label": c["label"]} for c in NUMBER_CARDS],
		"charts": [{"chart_name": name, "label": name} for name, *_rest in CHARTS],
		"shortcuts": layout["shortcuts"],
		"links": layout["links"],
		"roles": [{"role": r} for r in VIEWERS],
	}
	for field, rows in tables.items():
		child = ws.meta.get_field(field).options
		frappe.db.delete(child, {"parent": ws.name, "parenttype": "Workspace", "parentfield": field})
		ws.set(field, [])
		for row in rows:
			ws.append(field, row).db_insert()
	ws.icon = layout["icon"]
	ws.content = json.dumps(_content(layout))
	ws.db_update()
	frappe.clear_cache()


def _content(layout):
	blocks = []

	def add(kind, **data):
		blocks.append({"id": frappe.generate_hash(length=10), "type": kind, "data": {**data, "col": data.get("col", 12)}})

	def header(text):
		add("header", text=f'<span class="h4"><b>{text}</b></span>')

	header(frappe._("IRD at a glance"))
	for card in NUMBER_CARDS:
		# A block names its workspace row by that row's label, not by the card record.
		add("number_card", number_card_name=card["label"], col=3)
	for name, _s, _t, width, _r in CHARTS:
		add("chart", chart_name=name, col=12 if width == "Full" else 6)
	header(frappe._("Shortcuts"))
	for s in layout["shortcuts"]:
		add("shortcut", shortcut_name=s["label"], col=3)
	header(frappe._("Registers and records"))
	for link in layout["links"]:
		if link.get("type") == "Card Break":
			add("card", card_name=link["label"], col=4)
	return blocks
