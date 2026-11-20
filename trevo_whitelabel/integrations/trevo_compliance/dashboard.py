"""Numbers and charts for the Trevo Compliance dashboard (Number Cards of type Custom and the
IRD chart sources). Trevo ships these; the figures come from Trevo Compliance's own registers.

IRD periods are Nepali (BS) months, so "this month" here is the current BS month, not the
English one Frappe's own date filters know. VAT figures come from the VAT Return Register's
own code, so a card always shows what the register (and the return filed from it) shows.

Each method first checks the user may run the register the number comes from.
"""

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate, today

from trevo_whitelabel.integrations.trevo_compliance.permissions import check_report_access


def _bs():
	"""Trevo Compliance's BS calendar helpers (imported on use: only sites with the app call these)."""
	from trevo_compliance.utils import NEPALI_MONTH_NAMES, bs_month_to_ad_range

	return NEPALI_MONTH_NAMES, bs_month_to_ad_range

THIS_MONTH, LAST_MONTH = "This Month", "Last Month"


def _bs_period(period):
	"""(bs_year, month name, from_date, to_date) of the current or the previous BS month."""
	import nepali_datetime

	NEPALI_MONTH_NAMES, bs_month_to_ad_range = _bs()
	bs = nepali_datetime.date.from_datetime_date(getdate(today()))
	if period == LAST_MONTH:
		bs = nepali_datetime.date.from_datetime_date(add_days(bs_month_to_ad_range(bs.year, NEPALI_MONTH_NAMES[bs.month - 1])[0], -1))
	name = NEPALI_MONTH_NAMES[bs.month - 1]
	from_date, to_date = bs_month_to_ad_range(bs.year, name)
	return bs.year, name, from_date, to_date


def _company(filters):
	return (
		filters.get("company")
		or frappe.defaults.get_user_default("Company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
	)


def _vat_figures(filters):
	from trevo_compliance.trevo_compliance.report.vat_return_register.vat_return_register import get_data

	check_report_access("VAT Return Register")
	filters = frappe._dict(frappe.parse_json(filters) or {})
	company = _company(filters)
	year, month, from_date, to_date = _bs_period(filters.get("period") or THIS_MONTH)
	if not company:
		return {}, (year, month)
	frappe.has_permission("Company", "read", doc=company, throw=True)
	rows = get_data(frappe._dict(company=company, bs_year=year, bs_month=month), from_date, to_date)
	return {r["box"]: r["amount"] for r in rows if r.get("box")}, (year, month)


def _vat_card(filters, box):
	boxes, (year, month) = _vat_figures(filters)
	return {
		"value": flt(boxes.get(box)),
		"fieldtype": "Currency",
		# The register for the same period (its filters are set from route_options).
		"route": ["query-report", "VAT Return Register"],
		"route_options": {"bs_year": year, "bs_month": month},
	}


@frappe.whitelist()
def output_vat(filters=None):
	"""Output VAT of the BS month (VAT Return Register box 5)."""
	return _vat_card(filters, 5)


@frappe.whitelist()
def input_vat(filters=None):
	"""Input VAT claimable in the BS month (box 9)."""
	return _vat_card(filters, 9)


@frappe.whitelist()
def net_vat(filters=None):
	"""Net VAT payable (refundable if negative) for the BS month (box 12); for the last month
	it is the amount of the return now due."""
	return _vat_card(filters, 12)


def _invoice_count(filters, extra, report):
	check_report_access(report)
	filters = frappe._dict(frappe.parse_json(filters) or {})
	_year, _month, from_date, to_date = _bs_period(filters.get("period") or THIS_MONTH)
	conditions = {"posting_date": ["between", [from_date, to_date]], **extra}
	company = _company(filters)
	if company:
		conditions["company"] = company
	# get_list: User Permissions (e.g. one Company) apply to the count.
	count = len(frappe.get_list("Sales Invoice", filters=conditions, pluck="name", limit=0))
	route_options = {k: (["Between", v[1]] if isinstance(v, list) else v) for k, v in conditions.items()}
	return {"value": count, "fieldtype": "Int", "route": ["List", "Sales Invoice"], "route_options": route_options}


@frappe.whitelist()
def credit_notes(filters=None):
	"""Credit notes (sales returns) issued in the BS month."""
	return _invoice_count(filters, {"docstatus": 1, "is_return": 1}, "Sales Return Register IRD")


@frappe.whitelist()
def cancelled_invoices(filters=None):
	"""Sales invoices of the BS month that were cancelled."""
	return _invoice_count(filters, {"docstatus": 2}, "Sales Cancellation Register")


def _fiscal_months():
	"""(bs_year, month name, from_date, to_date) for each month of the current Nepali fiscal
	year (Shrawan to Ashad) up to this month."""
	import nepali_datetime

	NEPALI_MONTH_NAMES, bs_month_to_ad_range = _bs()
	bs = nepali_datetime.date.from_datetime_date(getdate(today()))
	fy_start = bs.year if bs.month >= 4 else bs.year - 1
	out = []
	for i in range(12):
		month_no = (3 + i) % 12 + 1  # Shrawan (4) ... Ashad (3)
		year = fy_start if month_no >= 4 else fy_start + 1
		if (year, month_no) > (bs.year, bs.month):
			break  # months still to come
		name = NEPALI_MONTH_NAMES[month_no - 1]
		out.append((year, name, *bs_month_to_ad_range(year, name)))
	return out


def _chart_company(filters, report):
	"""The company a chart is drawn for, after checking the user may run its register."""
	check_report_access(report)
	filters = frappe._dict(frappe.parse_json(filters) or {})
	company = _company(filters)
	if not company:
		frappe.throw(_("Set a default Company to see this chart."))
	frappe.has_permission("Company", "read", doc=company, throw=True)
	return company


def _chart(labels, datasets, chart_type="bar"):
	return {"labels": labels, "datasets": [{"name": n, "values": v} for n, v in datasets], "type": chart_type}


def _sales_totals(company, from_date, to_date):
	from trevo_compliance.trevo_compliance.report.vat_return_register.vat_return_register import (
		_get_sales_totals,
	)

	return _get_sales_totals(frappe._dict(company=company), from_date, to_date)


@frappe.whitelist()
def sales_by_bs_month(filters=None, **kwargs):
	"""Chart source "IRD Sales by BS Month": gross sales and output VAT per Nepali month of the
	fiscal year, as the VAT Return Register counts them."""
	company = _chart_company(filters, "VAT Return Register")
	labels, sales, vat = [], [], []
	for _year, name, from_date, to_date in _fiscal_months():
		total, _taxable, output_vat, _export, _exempt = _sales_totals(company, from_date, to_date)
		labels.append(_(name))
		sales.append(total)
		vat.append(output_vat)
	return _chart(labels, [(_("Gross sales"), sales), (_("Output VAT"), vat)])


@frappe.whitelist()
def vat_by_bs_month(filters=None, **kwargs):
	"""Chart source "IRD VAT by BS Month": output VAT, input VAT and the net payable per month
	(VAT Return Register boxes 5, 9 and 12)."""
	from trevo_compliance.trevo_compliance.report.vat_return_register.vat_return_register import get_data

	company = _chart_company(filters, "VAT Return Register")
	labels, output, inp, net = [], [], [], []
	for year, name, from_date, to_date in _fiscal_months():
		boxes = {r["box"]: r["amount"] for r in get_data(frappe._dict(company=company, bs_year=year, bs_month=name), from_date, to_date) if r.get("box")}
		labels.append(_(name))
		output.append(flt(boxes.get(5)))
		inp.append(flt(boxes.get(9)))
		net.append(flt(boxes.get(12)))
	return _chart(labels, [(_("Output VAT"), output), (_("Input VAT"), inp), (_("Net VAT"), net)])


@frappe.whitelist()
def sales_mix_by_bs_month(filters=None, **kwargs):
	"""Chart source "IRD Sales Mix by BS Month": taxable, exempt and export (zero-rated) sales,
	the split of VAT Return Register boxes 2 to 4."""
	company = _chart_company(filters, "VAT Return Register")
	labels, taxable, exempt, export = [], [], [], []
	for _year, name, from_date, to_date in _fiscal_months():
		_total, t, _vat, x, e = _sales_totals(company, from_date, to_date)
		labels.append(_(name))
		taxable.append(t)
		exempt.append(e)
		export.append(x)
	return _chart(labels, [(_("Taxable"), taxable), (_("Exempt"), exempt), (_("Export"), export)])


@frappe.whitelist()
def returns_by_bs_month(filters=None, **kwargs):
	"""Chart source "IRD Returns by BS Month": credit notes and cancelled invoices per month."""
	company = _chart_company(filters, "Sales Cancellation Register")
	frappe.has_permission("Sales Invoice", "report", throw=True)
	labels, returns, cancelled = [], [], []
	for _year, name, from_date, to_date in _fiscal_months():
		base = {"company": company, "posting_date": ["between", [from_date, to_date]]}
		count = lambda extra: len(frappe.get_list("Sales Invoice", filters={**base, **extra}, pluck="name", limit=0))  # noqa: E731
		labels.append(_(name))
		returns.append(count({"docstatus": 1, "is_return": 1}))
		cancelled.append(count({"docstatus": 2}))
	return _chart(labels, [(_("Credit notes"), returns), (_("Cancelled"), cancelled)])


@frappe.whitelist()
def cbms_status(filters=None, **kwargs):
	"""Chart source "IRD CBMS Status": submitted invoices of the fiscal year by CBMS status."""
	company = _chart_company(filters, "IRD Sales Data Sync Report")
	months = _fiscal_months()
	rows = frappe.get_list(
		"Sales Invoice",
		filters={"company": company, "docstatus": 1, "posting_date": ["between", [months[0][2], months[-1][3]]]},
		fields=["custom_cbms_status as status", {"COUNT": "*", "as": "count"}],
		group_by="custom_cbms_status",
	)
	counts = {r.status or "": r.count for r in rows}
	labels = [_("Sent"), _("Failed"), _("Not sent")]
	return _chart(labels, [(_("Invoices"), [counts.get("Success", 0), counts.get("Failed", 0), counts.get("", 0)])])


@frappe.whitelist()
def top_customers_by_vat(filters=None, **kwargs):
	"""Chart source "IRD Top Customers by VAT": the ten customers charged the most output VAT
	this fiscal year (credit notes net off), from the same tax split as the registers."""
	from trevo_compliance.utils import SALES_TAX_BREAKUP_SQL

	company = _chart_company(filters, "Party-wise Sales Register")
	months = _fiscal_months()
	rows = frappe.db.sql(
		f"""
		SELECT COALESCE(si.customer_name, si.customer) AS customer, SUM(COALESCE(stx.vat, 0)) AS vat
		FROM `tabSales Invoice` si
		LEFT JOIN {SALES_TAX_BREAKUP_SQL} stx ON stx.parent = si.name
		WHERE si.company = %(company)s AND si.docstatus = 1
			AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
		GROUP BY 1
		HAVING SUM(COALESCE(stx.vat, 0)) > 0
		ORDER BY 2 DESC
		LIMIT 10
		""",
		{"company": company, "from_date": months[0][2], "to_date": months[-1][3]},
		as_dict=True,
	)
	return _chart([r.customer for r in rows], [(_("Output VAT"), [flt(r.vat, 2) for r in rows])])
