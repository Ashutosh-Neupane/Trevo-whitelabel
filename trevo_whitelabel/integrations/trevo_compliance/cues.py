"""Trevo Compliance work lists for the Trevo home's "Needs your attention" (hook `trevo_home_cues`).

Each cue counts documents waiting for someone and opens the list with the same filters. The
home shows a cue only to users whose roles name its module (hook `trevo_role_modules`) and
who may read its DocType; counts go through frappe.get_list, so permissions apply.
"""

from frappe import _

MODULE = "Trevo Compliance"


def get_cues():
	sent = ["docstatus", "=", 1]
	return [
		dict(key="cbms_failed", modules=[MODULE], doctype="Sales Invoice", label=_("Invoices CBMS rejected"),
			tone="danger", icon="circle-x", filters=[sent, ["custom_cbms_status", "=", "Failed"]],
			amount="base_grand_total", keywords="cbms ird failed sync"),
		# Blank status: never sent (auto sync off, or submitted before CBMS was set up).
		dict(key="cbms_not_sent", modules=[MODULE], doctype="Sales Invoice", label=_("Invoices not sent to IRD"),
			tone="warning", icon="send", filters=[sent, ["custom_cbms_status", "is", "not set"]],
			amount="base_grand_total", keywords="cbms ird sync pending"),
		# The reason is required on submit now; older credit notes and drafts may lack it.
		dict(key="returns_no_reason", modules=[MODULE, "Accounts"], doctype="Sales Invoice",
			label=_("Credit notes missing return reason"), tone="warning", icon="undo-2",
			filters=[["is_return", "=", 1], ["docstatus", "<", 2], ["custom_return_reason", "is", "not set"]],
			keywords="credit note return reason ird"),
		dict(key="bc_disputed", modules=[MODULE], doctype="Balance Confirmation", label=_("Balance confirmations disputed"),
			tone="danger", icon="message-square-warning", filters=[["status", "=", "Disputed"]]),
		dict(key="bc_awaiting", modules=[MODULE], doctype="Balance Confirmation",
			label=_("Balance confirmations awaiting reply"), tone="info", icon="mail-question",
			filters=[["status", "=", "Sent"]]),
	]

