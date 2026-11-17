import frappe
from frappe.model.document import Document


class TrevoSettings(Document):
	def on_update(self):
		# The value is sent to the desk in the boot payload, which is cached per user.
		frappe.clear_cache()
