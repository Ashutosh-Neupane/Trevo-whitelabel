import frappe
from frappe.www.desk import get_context as frappe_get_context

def get_context(context):
    return frappe_get_context(context)
