"""Search bar results beyond DocType names, through Frappe's `awesomebar_search` hook.

Frappe's search box matches DocType, report and page names. Typing a document number, a
customer's name or "overdue" offered only "Search for …" (the full-text search page), and
"SINV" matched "POS Invoice" by its letters. This adds, as the user types:
  - documents whose number contains the text ("00012", "SINV-2026-001")
  - the DocType a number prefix belongs to ("SINV" → Sales Invoice, "PUR-ORD" → Purchase Order)
  - customers, suppliers, items, projects, leads and employees by name
  - the home's work lists by their words ("overdue", "late", "to bill"), opening the list with
    the same filters as the home

Every lookup goes through frappe.get_list / has_permission, so a user finds only what they
may read. Frappe calls the hook with the typed text and adds the results to its own.
"""

import re

import frappe
from frappe import _
from frappe.utils import escape_html

# Documents searched by number, in the order people usually look for them.
NUMBER_DOCTYPES = (
	"Sales Invoice", "Sales Order", "Quotation", "Delivery Note", "Purchase Order", "Purchase Invoice",
	"Purchase Receipt", "Material Request", "Payment Entry", "Journal Entry", "Stock Entry", "Work Order",
	"Issue", "Task", "Delivery Trip", "Opportunity", "Lead", "Project", "Asset", "Quality Inspection",
)
# Master records searched by name: DocType → its title field.
NAMED_DOCTYPES = {
	"Customer": "customer_name", "Supplier": "supplier_name", "Item": "item_name", "Project": "project_name",
	"Lead": "lead_name", "Employee": "employee_name", "Contact": "full_name",
}
PER_DOCTYPE = 3
MAX_RESULTS = 12
# Frappe's own "Search for …" row ranks 100; its letter-by-letter DocType matches score up to a
# few hundred ("late" → "Email Template"). A document number, a work list whose words all
# match, or a number prefix is what the user meant, so they rank above those; names below.
RANK_DOCUMENT, RANK_WORK, RANK_SERIES, RANK_NAMED = 1000, 900, 800, 95


def awesomebar_results(txt):
	txt = (txt or "").strip()
	if len(txt) < 2 or len(txt) > 80:
		return []
	out = []
	out += _work_lists(txt)
	out += _series_doctypes(txt)
	if re.search(r"\d", txt) and len(txt) >= 3:
		out += _documents_by_number(txt)
	elif len(txt) >= 3:
		out += _records_by_name(txt)
	return out[:MAX_RESULTS]


def _can_read(doctype):
	return frappe.db.exists("DocType", doctype) and frappe.has_permission(doctype, "read")


def _documents_by_number(txt):
	out = []
	for doctype in NUMBER_DOCTYPES:
		if len(out) >= MAX_RESULTS or not _can_read(doctype):
			continue
		meta = frappe.get_meta(doctype)
		title = meta.title_field if meta.title_field and meta.title_field != "name" else None
		try:
			rows = frappe.get_list(doctype, filters={"name": ["like", f"%{txt}%"]},
				fields=["name"] + ([title] if title else []), limit=PER_DOCTYPE, order_by="modified desc")
		except Exception:
			continue
		for row in rows:
			detail = row.get(title) if title else ""
			out.append({
				"label": f"<b>{escape_html(row.name)}</b>",
				"value": row.name,
				"description": escape_html(f"{_(doctype)}{' · ' + str(detail) if detail and detail != row.name else ''}"),
				"route": ["Form", doctype, row.name],
				"index": RANK_DOCUMENT,
			})
	return out


def _records_by_name(txt):
	out = []
	for doctype, field in NAMED_DOCTYPES.items():
		if not _can_read(doctype) or not frappe.get_meta(doctype).has_field(field):
			continue
		try:
			rows = frappe.get_list(doctype, or_filters={"name": ["like", f"%{txt}%"], field: ["like", f"%{txt}%"]},
				fields=["name", field], limit=PER_DOCTYPE, order_by="modified desc")
		except Exception:
			continue
		for row in rows:
			title = row.get(field) or row.name
			out.append({
				"label": f"<b>{escape_html(title)}</b>",
				"value": f"{title} {row.name}",
				"description": escape_html(_(doctype) + (f" · {row.name}" if row.name != title else "")),
				"route": ["Form", doctype, row.name],
				"index": RANK_NAMED,
			})
	return out


def _series_doctypes(txt):
	"""'SINV' → Sales Invoice: the DocTypes whose naming series contains the typed code."""
	code = re.sub(r"[^A-Z0-9-]", "", txt.upper()).strip("-")
	if len(code) < 2 or not re.search(r"[A-Z]", code):
		return []
	out, listed = [], set()
	for token, doctypes in _series_tokens().items():
		if token != code and not (len(code) >= 3 and token.startswith(code)):
			continue
		for doctype in doctypes:
			if doctype not in listed and _can_read(doctype):
				listed.add(doctype)
				out.append({
					"label": f"<b>{escape_html(_(doctype))}</b> {escape_html(_('List'))}",
					"value": f"{_(doctype)} {token}",
					"description": escape_html(_("Numbered {0}…").format(token)),
					"route": ["List", doctype],
					"index": RANK_SERIES,
				})
	return out[:4]


def _series_tokens():
	"""Naming-series code → DocTypes using it (ACC-SINV-.YYYY.- gives SINV). Codes shared by
	many DocTypes (ACC, MAT, PUR) say nothing on their own and are left out."""
	cached = frappe.cache.get_value("trevo_series_tokens")
	if cached is not None:
		return cached
	seen = {}
	for doctype in frappe.get_all("DocType", filters={"istable": 0, "issingle": 0, "autoname": ["like", "%naming_series%"]}, pluck="name"):
		field = frappe.get_meta(doctype).get_field("naming_series")
		for option in (field.options or "").split("\n") if field else []:
			option = option.upper()
			for token in re.split(r"[-./#]", option):
				if len(token) >= 2 and token.isalpha() and token not in {"YYYY", "YY", "MM", "DD", "FY"}:
					seen.setdefault(token, set()).add(doctype)
			# The whole prefix too ("PUR-ORD"), so a code whose parts are shared still resolves.
			prefix = re.split(r"[.#]", option)[0].strip("-")
			if "-" in prefix:
				seen.setdefault(prefix, set()).add(doctype)
	tokens = {t: sorted(d) for t, d in seen.items() if len(d) <= 2}
	frappe.cache.set_value("trevo_series_tokens", tokens, expires_in_sec=6 * 3600)
	return tokens


def _work_lists(txt):
	"""The home's work lists ("Overdue customer invoices") whose words contain the typed words."""
	from trevo_whitelabel.desk import home

	words = [w for w in re.split(r"\s+", txt.lower()) if len(w) >= 3]
	if not words:
		return []
	mine = home._user_modules(None)
	roles = set(frappe.get_roles())
	out = []
	for cue in home.all_cue_definitions():
		label = str(cue["label"])
		# An app's cue may add search words ("cbms" for "Invoices not sent to IRD").
		text = f"{label} {cue.get('keywords') or ''}".lower()
		if not all(w in text for w in words):
			continue
		module = next((m for m in cue["modules"] if mine is None or m in mine), None)
		if not module or not _can_read(cue["doctype"]):
			continue
		filters = list(cue["filters"])
		if cue.get("own") and not home._sees_team(module, roles):
			own = cue["own"]
			if own in ("owner", "lead_owner", "opportunity_owner"):
				filters.append([own, "=", frappe.session.user])
			elif own == "_assign":
				filters.append([own, "like", f"%{frappe.session.user}%"])
		out.append({
			"label": f"<b>{escape_html(label)}</b>",
			"value": label,
			"description": escape_html(_("{0} · filtered list").format(_(cue["doctype"]))),
			"route": ["List", cue["doctype"]],
			"route_options": _route_options(filters),
			"index": RANK_WORK,
		})
	return out[:4]


def _route_options(filters):
	options = {}
	for field, op, value in filters:
		if op == "=":
			options[field] = value
		elif op == "between":
			options[field] = ["Between", value]
		else:
			options[field] = [op, value]
	return options


def start_links(bootinfo):
	"""The search box opens on the user's most visited pages (Route History). A new user has
	none, and the box opened empty: pad it with the lists of their own work."""
	links = list(bootinfo.get("frequently_visited_links") or [])
	if len(links) >= 5 or frappe.session.user == "Guest":
		return
	from trevo_whitelabel.desk import home

	have = {link.get("route") for link in links}
	mine = home._user_modules(None)
	candidates = [c["doctype"] for c in home.all_cue_definitions() if mine is None or any(m in mine for m in c["modules"])]
	candidates += list(home.DRAFT_DOCTYPES)
	readable = set(frappe.get_user().get_can_read())
	own = readable - home._base_only_readable(readable)
	for doctype in dict.fromkeys(candidates):
		route = f"List/{doctype}"
		if len(links) >= 5:
			break
		if doctype in own and route not in have:
			links.append({"route": route, "count": 0})
	bootinfo.frequently_visited_links = links
