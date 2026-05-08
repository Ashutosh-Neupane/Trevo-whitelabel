import frappe

def run():
    """Fix navbar items (About, Support) and rebrand them to Trevo."""
    
    # 1. Fix Navbar Items - rename any "Frappe" references
    items = frappe.db.sql(
        "SELECT name, item_label FROM `tabNavbar Item` WHERE item_label LIKE '%Frappe%' OR item_label LIKE '%frappe%'",
        as_dict=True
    )
    
    print(f"Found {len(items)} navbar items with 'Frappe' in label")
    
    replacements = {
        "Frappe Support": "Trevo Support",
        "Frappe School": "Trevo Academy",
        "Frappe Forum": "Trevo Forum",
        "About Frappe Framework": "About Trevo",
        "Frappe Framework": "Trevo Framework",
    }
    
    for item in items:
        new_label = item.item_label
        for old, new in replacements.items():
            new_label = new_label.replace(old, new)
        
        # General fallback
        if "Frappe" in new_label:
            new_label = new_label.replace("Frappe", "Trevo")
        if "frappe" in new_label:
            new_label = new_label.replace("frappe", "trevo")
            
        if new_label != item.item_label:
            frappe.db.set_value("Navbar Item", item.name, "item_label", new_label)
            print(f"  Renamed: '{item.item_label}' -> '{new_label}'")
    
    # 2. Also check help_dropdown and settings_dropdown items in Navbar Settings
    # The navbar settings doc has help_dropdown and settings_dropdown child tables
    try:
        ns = frappe.get_doc("Navbar Settings")
        
        for field in ["help_dropdown", "settings_dropdown"]:
            if hasattr(ns, field):
                for row in getattr(ns, field):
                    if row.item_label and ("Frappe" in row.item_label or "frappe" in row.item_label):
                        old_label = row.item_label
                        new_label = old_label
                        for old, new in replacements.items():
                            new_label = new_label.replace(old, new)
                        if "Frappe" in new_label:
                            new_label = new_label.replace("Frappe", "Trevo")
                        if "frappe" in new_label:
                            new_label = new_label.replace("frappe", "trevo")
                        row.item_label = new_label
                        print(f"  [{field}] Renamed: '{old_label}' -> '{new_label}'")
        
        ns.save(ignore_permissions=True)
        print("Navbar Settings saved.")
    except Exception as e:
        print(f"Error updating Navbar Settings: {e}")
    
    # 3. Print all current navbar items for verification
    all_items = frappe.db.sql(
        "SELECT item_label, item_type, route, parentfield FROM `tabNavbar Item` ORDER BY parentfield, idx",
        as_dict=True
    )
    print("\n--- Current Navbar Items ---")
    for item in all_items:
        print(f"  [{item.parentfield}] {item.item_label} | {item.item_type} | {item.route}")
    
    frappe.db.commit()
    print("\nNavbar rebranding complete.")

if __name__ == "__main__":
    run()
